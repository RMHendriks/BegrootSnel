package nl.hend.rm.resources;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import nl.hend.rm.dto.TransactionPeriodReportDto;
import nl.hend.rm.service.ReportService;

import java.time.LocalDate;

@Path("/reports")
public class ReportResource {

    @Inject
    ReportService rs;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response getReport(@QueryParam("from") LocalDate from, @QueryParam("to") LocalDate to) {
        TransactionPeriodReportDto dto = rs.getReportByDates(from, to);
        return Response.ok(dto).build();
    }

    @GET
    @Path("/{year}/{month}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getReportByMonthYear(@PathParam("year") int year, @PathParam("month") int month) {
        TransactionPeriodReportDto dto = rs.getReportByMonthYear(year, month);
        return Response.ok(dto).build();
    }
}
