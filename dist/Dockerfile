FROM node:26-alpine
WORKDIR /app
COPY . .
RUN node scripts/runtime/railway-predeploy.cjs
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD node -e "require('http').get('http://localhost:8080/api/health', r => process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["sh", "-c", "USECLEVR_SERVER_TARGET=railway node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs"]
