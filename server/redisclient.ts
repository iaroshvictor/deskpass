import { createClient } from "redis";

export default await createClient().on("error", (err) => console.log("Redis Client Error", err))
  .connect();
