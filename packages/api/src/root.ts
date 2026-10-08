import { agendaRouter } from "./router/agenda";
import { authRouter } from "./router/auth";
import { commonAreaRouter } from "./router/commonArea";
import { communityRouter } from "./router/community";
import { documentRouter } from "./router/document";
import { feeRouter } from "./router/fee";
import { incidentRouter } from "./router/incident";
import { noticeRouter } from "./router/notice";
import { notificationRouter } from "./router/notification";
import { postRouter } from "./router/post";
import { providerRouter } from "./router/provider";
import { superadminRouter } from "./router/superadmin";
import { votingRouter } from "./router/voting";
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
