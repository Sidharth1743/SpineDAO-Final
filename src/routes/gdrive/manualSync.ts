import { type Route, type IAgentRuntime, logger } from "@elizaos/core";
import { syncGoogleDriveChanges } from "../controller";

export const gdriveManualSync: Route = {
  path: "/gdrive/sync",
  type: "GET",
  handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
    try {
      logger.info("Manual Google Drive sync triggered");
      let result = await syncGoogleDriveChanges(runtime);
      logger.info(`Changes: ${result.changes}`);
      let iterations = 0;
      const maxIterations = 10;
      while (result.changes > 0 && iterations < maxIterations) {
        logger.info(`Sync iteration ${iterations + 1}, changes: ${result.changes}`);
        result = await syncGoogleDriveChanges(runtime);
        iterations++;
      }
      if (iterations === maxIterations) {
        logger.warn("Max sync iterations reached. There may be a stuck state or repeated changes.");
      }
      res.json({
        message: "Sync completed successfully",
        ...result,
        iterations,
      });
    } catch (error) {
      logger.error("Error during manual Google Drive sync:", error);
      res.status(500).json({
        message: "Error during sync",
        error: error.message,
      });
    }
  },
};
