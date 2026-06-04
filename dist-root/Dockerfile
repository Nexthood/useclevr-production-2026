FROM node:26-alpine
WORKDIR /app
COPY dist/ .
EXPOSE 8080
CMD ["node", "-r", "./scripts/runtime/load-env.cjs", "./scripts/runtime/start-dist.cjs"]
