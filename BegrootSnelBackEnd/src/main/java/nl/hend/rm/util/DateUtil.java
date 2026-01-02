package nl.hend.rm.util;

import java.time.LocalDate;

public class DateUtil {

    public static LocalDate getFirstDayOfMonth(int year, int month) {
        return LocalDate.of(year, month, 1);
    }

    public static LocalDate getLastDayOfMonth(LocalDate firstDayOfMonth) {
        return firstDayOfMonth.withDayOfMonth(firstDayOfMonth.lengthOfMonth());
    }
}
