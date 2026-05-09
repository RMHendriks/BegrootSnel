package nl.hend.rm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.File;
import java.util.Map;
import nl.hend.rm.entities.Transaction;
import nl.hend.rm.service.TransactionService;

@Path("/transactions")
public class TransactionResource {

    @Inject
    TransactionService ts;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response getAll(@QueryParam("accountId") Long accountId) {
        if (accountId != null) {
            return Response.ok(ts.getByAccount(accountId)).build();
        }
        return Response.ok(ts.getAll()).build();
    }

    @Path("/load")
    @GET
    @Consumes(MediaType.APPLICATION_JSON)
    public Response importFile() {
        ts.parseTransactionsFromFile(
            new File("src/main/resources/documents/TXT251228152450.TAB")
        );
        return Response.ok().build();
    }

    @Path("/{id}")
    @PUT
    @Consumes(MediaType.APPLICATION_JSON)
    public Response updateTransaction(
        @PathParam("id") long id,
        Transaction transaction
    ) {
        Transaction updatedTransaction = ts.updateTransaction(id, transaction);
        return Response.accepted(updatedTransaction).build();
    }

    // ── DELETE /transactions/{id} ─────────────────────────────────────────────
    // Deletes a single transaction. Only succeeds for orphaned transactions
    // (no file associations). Returns 409 Conflict if the transaction still
    // belongs to a file.

    @DELETE
    @Path("/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response deleteTransaction(@PathParam("id") long id) {
        boolean deleted = ts.deleteTransaction(id);
        if (!deleted) {
            // Either not found, or has file associations
            Transaction t = Transaction.findById(id);
            if (t == null) {
                return Response.status(Response.Status.NOT_FOUND).build();
            }
            return Response.status(Response.Status.CONFLICT)
                .entity(
                    Map.of(
                        "error",
                        "Transaction has file associations and cannot be deleted"
                    )
                )
                .build();
        }
        return Response.ok(Map.of("deleted", true)).build();
    }

    // ── DELETE /transactions/orphaned ─────────────────────────────────────────
    // Bulk-deletes all orphaned transactions. Optional ?accountId= filter.

    @DELETE
    @Path("/orphaned")
    @Produces(MediaType.APPLICATION_JSON)
    public Response deleteOrphaned(@QueryParam("accountId") Long accountId) {
        int count = ts.deleteOrphanedTransactions(accountId);
        return Response.ok(Map.of("deletedCount", count)).build();
    }
}
