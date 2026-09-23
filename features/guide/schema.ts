import { z } from "zod";

/** A saved tour step: an index into the person's tour, or one past its end when finished. */
export const tourStepSchema = z.number().int().min(0).max(100);
