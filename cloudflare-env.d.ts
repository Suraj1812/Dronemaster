declare namespace Cloudflare {
  interface Env {
    DRONEMASTER_BRIDGE_SECRET?:string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
