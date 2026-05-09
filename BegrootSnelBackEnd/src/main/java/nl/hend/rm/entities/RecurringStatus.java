package nl.hend.rm.entities;

public enum RecurringStatus {
    /** Auto-detected, awaiting user confirmation. */
    DETECTED,
    /** Confirmed by user, active for budget automation. */
    CONFIRMED,
    /** Dismissed by user, hidden from view. */
    DISMISSED
}
