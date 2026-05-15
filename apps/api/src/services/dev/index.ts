import { countUsers as countUserRecords } from "@/models/dev";

export const countUsers = (): Promise<number> => countUserRecords();
