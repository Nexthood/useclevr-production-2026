FROM node:26-alpine
WORKDIR /app
COPY dist/ .
RUN npm install -g pnpm@11.5.0 && pnpm install --prod 2>&1; pnpm approve-builds 2>/dev/null || true
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD node -e "require('http').get('http://localhost:8080/api/health', r => process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "-r", "./scripts/runtime/load-env.cjs", "./scripts/runtime/start-dist.cjs"]
