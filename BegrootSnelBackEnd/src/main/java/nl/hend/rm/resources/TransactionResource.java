package nl.hend.rm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import nl.hend.rm.entities.Transaction;
import nl.hend.rm.service.TransactionService;

import java.io.File;


@Path("/transactions")
public class TransactionResource {

    @Inject
    TransactionService ts;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response getAll() {
        return Response.ok(ts.getAll()).build();
    }

    @Path("/load")
    @GET
    @Consumes(MediaType.APPLICATION_JSON)
    public Response importFile() {
        ts.parseTransactionsFromFile(new File("src/main/resources/documents/TXT251228152450.TAB"));
        return Response.ok().build();
    }

    @Path("/{id}")
    @PUT
    @Consumes(MediaType.APPLICATION_JSON)
    public Response updateTransaction(@PathParam("id") long id, Transaction transaction) {
        Transaction updatedTransaction = ts.updateTransaction(id, transaction);
        return Response.accepted(updatedTransaction).build();
    }
}
