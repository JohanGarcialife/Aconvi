import { authClient } from "./src/utils/auth";
console.log(Object.keys(authClient));
console.log(authClient.$store?.constructor?.name);
