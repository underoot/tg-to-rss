import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import builtins from "rollup-plugin-node-builtins";

export default {
  input: "index.mjs",
  output: {
    file: "packages/tg-to-rss/transform/transform.js",
    format: "cjs",
  },
  plugins: [nodeResolve(), commonjs(), builtins()],
};
