package nl.hend.rm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import nl.hend.rm.entities.BankAccount;
import nl.hend.rm.service.BankAccountService;

import java.util.List;

@Path("/accounts")
public class BankAccountResource {

    @Inject
    BankAccountService bankAccountService;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response getAll() {
        List<BankAccount> accounts = bankAccountService.listAll();
        return Response.ok(accounts).build();
    }

    @GET
    @Path("/active")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getActive() {
        List<BankAccount> accounts = bankAccountService.listActive();
        return Response.ok(accounts).build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response create(BankAccount account) {
        try {
            BankAccount created = bankAccountService.create(account);
            return Response.status(Response.Status.CREATED).entity(created).build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.CONFLICT)
                .entity("{\"error\": \"" + e.getMessage() + "\"}")
                .build();
        }
    }

    @PUT
    @Path("/{id}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response update(@PathParam("id") Long id, BankAccount account) {
        try {
            BankAccount updated = bankAccountService.update(id, account);
            return Response.ok(updated).build();
        } catch (NotFoundException e) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        try {
            bankAccountService.delete(id);
            return Response.noContent().build();
        } catch (NotFoundException e) {
            return Response.status(Response.Status.NOT_FOUND).build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.CONFLICT)
                .entity("{\"error\": \"" + e.getMessage() + "\"}")
                .build();
        }
    }
}
