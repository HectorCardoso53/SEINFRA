module.exports = {
  apps: [
    {
      name: "seinfra-api",
      script: "node_modules\\.bin\\tsx.cmd",
      args: "src/index.ts",
      cwd: __dirname,
      watch: false,
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
