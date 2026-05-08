package nl.hend.rm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.LocalDate;
import java.util.List;
import nl.hend.rm.dto.SavingsAnalysisDto;
import nl.hend.rm.entities.BankAccount;
import nl.hend.rm.service.BankAccountService;
import nl.hend.rm.service.SavingsAnalysisService;

@Path("/accounts")
public class BankAccountResource {

    @Inject
    BankAccountService bankAccountService;

    @Inject
    SavingsAnalysisService savingsAnalysisService;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response getAll(@QueryParam("balanceDate") String balanceDateStr) {
        LocalDate balanceDate = parseBalanceDate(balanceDateStr);
        List<BankAccount> accounts = bankAccountService.listAll(balanceDate);
        return Response.ok(accounts).build();
    }

    @GET
    @Path("/active")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getActive(
        @QueryParam("balanceDate") String balanceDateStr
    ) {
        LocalDate balanceDate = parseBalanceDate(balanceDateStr);
        List<BankAccount> accounts = bankAccountService.listActive(balanceDate);
        return Response.ok(accounts).build();
    }

    @GET
    @Path("/{id}/savings-analysis")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getSavingsAnalysis(
        @PathParam("id") Long id,
        @QueryParam("months") @DefaultValue("6") int months,
        @QueryParam("year") Integer year,
        @QueryParam("month") Integer month
    ) {
        SavingsAnalysisDto analysis = savingsAnalysisService.getSavingsAnalysis(
            id,
            months,
            year,
            month
        );
        return Response.ok(analysis).build();
    }

    private static LocalDate parseBalanceDate(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDate.parse(s);
        } catch (Exception e) {
            return null;
        }
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response create(BankAccount account) {
        try {
            BankAccount created = bankAccountService.create(account);
            return Response.status(Response.Status.CREATED)
                .entity(created)
                .build();
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
