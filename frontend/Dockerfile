FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . ./

# Baked in at build time (browser uses these; localhost = user's browser, correct).
ARG NEXT_PUBLIC_AUTH_URL=http://localhost:4001
ARG NEXT_PUBLIC_CASE_URL=http://localhost:4002
ARG NEXT_PUBLIC_FILE_URL=http://localhost:4003
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL
ENV NEXT_PUBLIC_CASE_URL=$NEXT_PUBLIC_CASE_URL
ENV NEXT_PUBLIC_FILE_URL=$NEXT_PUBLIC_FILE_URL

RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0"]
