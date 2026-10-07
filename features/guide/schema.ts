import { z } from "zod";

import { TOUR_DONE } from "@/features/guide/tour";

/** A saved tour step: an index into the person's tour, or the mark of a finished one. */
export const tourStepSchema = z.number().int().min(0).max(TOUR_DONE);
