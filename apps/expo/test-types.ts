import { api } from "./src/utils/api";
import { useQuery } from "@tanstack/react-query";

const options = api.voting.all.queryOptions({ tenantId: "123" });
type Result = typeof options;
