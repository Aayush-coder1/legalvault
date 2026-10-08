FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . ./

# Baked in at build time (browser uses these; localhost = user's browser, correct).
# All point at the api-gateway (single entry point, port 4000).
ARG NEXT_PUBLIC_GATEWAY_URL=http://localhost:4000
ARG NEXT_PUBLIC_AUTH_URL=http://localhost:4000
ARG NEXT_PUBLIC_CASE_URL=http://localhost:4000
ARG NEXT_PUBLIC_FILE_URL=http://localhost:4000
ENV NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL
ENV NEXT_PUBLIC_CASE_URL=$NEXT_PUBLIC_CASE_URL
ENV NEXT_PUBLIC_FILE_URL=$NEXT_PUBLIC_FILE_URL

RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:3000').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0"]
