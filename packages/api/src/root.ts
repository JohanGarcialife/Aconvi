import { authRouter } from "./router/auth";
import { postRouter } from "./router/post";
import { incidentRouter } from "./router/incident";
import { noticeRouter } from "./router/notice";
import { communityRouter } from "./router/community";
import { notificationRouter } from "./router/notification";
import { commonAreaRouter } from "./router/commonArea";
import { providerRouter } from "./router/provider";
import { documentRouter } from "./router/document";
import { votingRouter } from "./router/voting";
import { agendaRouter } from "./router/agenda";
import { superadminRouter } from "./router/superadmin";
import { feeRouter } from "./router/fee";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  post: postRouter,
  incident: incidentRouter,
  notice: noticeRouter,
  community: communityRouter,
  notification: notificationRouter,
  commonArea: commonAreaRouter,
  provider: providerRouter,
  document: documentRouter,
  voting: votingRouter,
  agenda: agendaRouter,
  superadmin: superadminRouter,
  fee: feeRouter,
});




// export type definition of API
export type AppRouter = typeof appRouter;
