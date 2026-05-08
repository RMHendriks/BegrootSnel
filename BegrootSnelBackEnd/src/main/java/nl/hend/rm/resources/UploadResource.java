package nl.hend.rm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import nl.hend.rm.entities.UploadedFile;
import nl.hend.rm.service.UploadFileService;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

@Path("/uploads")
public class UploadResource {

    @Inject
    UploadFileService uploadFileService;

    // ── GET /uploads ──────────────────────────────────────────────────────────
    // Returns uploaded files with gap status computed per account.
    // Optional ?accountId= filter returns files for a single account only.

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response getAll(@QueryParam("accountId") Long accountId) {
        List<UploadedFile> files;
        if (accountId != null) {
            files = uploadFileService.getAllWithGapStatusByAccount(accountId);
        } else {
            files = uploadFileService.getAllWithGapStatus();
        }
        return Response.ok(files).build();
    }

    // ── POST /uploads ─────────────────────────────────────────────────────────
    // Accepts a multipart/form-data body with a single "file" part (.TAB).
    // Parses the file, persists new transactions, creates the UploadedFile record.

    @POST
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.APPLICATION_JSON)
    public Response upload(@RestForm("file") FileUpload file) {
        if (file == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(
                    "{\"error\": \"No file provided (form field name must be 'file')\"}"
                )
                .build();
        }

        String filename = file.fileName();
        if (filename == null || !filename.matches("(?i).*\\.tab$")) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity("{\"error\": \"Only .TAB files are accepted\"}")
                .build();
        }

        try {
            UploadedFile result = uploadFileService.processUpload(
                file.uploadedFile(),
                filename
            );
            return Response.status(Response.Status.CREATED)
                .entity(result)
                .build();
        } catch (IllegalArgumentException e) {
            return Response.status(422)
                .entity("{\"error\": \"" + e.getMessage() + "\"}")
                .build();
        }
    }

    // ── PUT /uploads/{id}/acknowledge ─────────────────────────────────────────
    // Called when the user presses X on a gap warning in the frontend.
    // Sets gapDismissed = true so the warning is no longer returned.

    @PUT
    @Path("/{id}/acknowledge")
    @Produces(MediaType.APPLICATION_JSON)
    public Response acknowledge(@PathParam("id") Long id) {
        try {
            UploadedFile updated = uploadFileService.acknowledgeGap(id);
            return Response.ok(updated).build();
        } catch (NotFoundException e) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
    }

    // ── DELETE /uploads/{id} ──────────────────────────────────────────────────
    // Removes the UploadedFile record. Does NOT delete the imported transactions.

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        try {
            uploadFileService.delete(id);
            return Response.noContent().build();
        } catch (NotFoundException e) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
    }
}
