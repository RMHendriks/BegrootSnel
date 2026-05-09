package nl.hend.rm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import nl.hend.rm.entities.BankAccount;
import nl.hend.rm.entities.RecurringStatus;
import nl.hend.rm.entities.RecurringTransaction;
import nl.hend.rm.service.RecurringTransactionService;

@Path("/recurring-transactions")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class RecurringTransactionResource {

    @Inject
    RecurringTransactionService rts;

    // ── GET all (optional status filter) ────────────────────────────────────

    @GET
    public Response getAll(@QueryParam("status") String statusFilter) {
        if (statusFilter != null && !statusFilter.isBlank()) {
            try {
                RecurringStatus status = RecurringStatus.valueOf(
                    statusFilter.toUpperCase()
                );
                return Response.ok(rts.getByStatus(status)).build();
            } catch (IllegalArgumentException e) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Invalid status: " + statusFilter))
                    .build();
            }
        }
        return Response.ok(rts.getAll()).build();
    }

    // ── GET one ─────────────────────────────────────────────────────────────

    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") Long id) {
        RecurringTransaction rt = rts.getById(id);
        if (rt == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(rt).build();
    }

    // ── POST scan / trigger detection ───────────────────────────────────────

    @POST
    @Path("/scan")
    public Response scan(@QueryParam("accountId") Long accountId) {
        List<RecurringTransaction> detected;
        if (accountId != null) {
            BankAccount account = BankAccount.findById(accountId);
            if (account == null) {
                return Response.status(Response.Status.NOT_FOUND)
                    .entity(Map.of("error", "Account not found"))
                    .build();
            }
            detected = rts.scanAccount(account);
        } else {
            detected = rts.scanAllAccounts();
        }
        return Response.ok(
            Map.of("newDetections", detected.size(), "detected", detected)
        ).build();
    }

    // ── PUT update ──────────────────────────────────────────────────────────

    @PUT
    @Path("/{id}")
    public Response update(
        @PathParam("id") Long id,
        RecurringTransaction updated
    ) {
        RecurringTransaction result = rts.update(id, updated);
        if (result == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(Map.of("updated", true, "id", result.id)).build();
    }

    // ── POST confirm ────────────────────────────────────────────────────────

    @POST
    @Path("/{id}/confirm")
    public Response confirm(@PathParam("id") Long id) {
        boolean ok = rts.confirm(id);
        if (!ok) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(Map.of("confirmed", true)).build();
    }

    // ── POST dismiss ────────────────────────────────────────────────────────

    @POST
    @Path("/{id}/dismiss")
    public Response dismiss(@PathParam("id") Long id) {
        boolean ok = rts.dismiss(id);
        if (!ok) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(Map.of("dismissed", true)).build();
    }

    // ── DELETE ──────────────────────────────────────────────────────────────

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        boolean ok = rts.delete(id);
        if (!ok) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(Map.of("deleted", true)).build();
    }

    // ── GET matching transactions ────────────────────────────────────────

    @GET
    @Path("/{id}/transactions")
    public Response getMatchingTransactions(@PathParam("id") Long id) {
        return Response.ok(rts.getMatchingTransactions(id)).build();
    }

    // ── GET missing budgets for a month ─────────────────────────────────

    @GET
    @Path("/missing-budgets/{year}/{month}")
    public Response getMissingBudgets(
        @PathParam("year") int year,
        @PathParam("month") int month
    ) {
        List<RecurringTransaction> missing = rts.getMissingBudgets(year, month);
        return Response.ok(missing).build();
    }
}
