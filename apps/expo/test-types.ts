import { useQuery } from "@tanstack/react-query";

import { api } from "./src/utils/api";

const options = api.voting.all.queryOptions({ tenantId: "123" });
type Result = typeof options;
