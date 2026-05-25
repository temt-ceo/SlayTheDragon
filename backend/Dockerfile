FROM golang:1.25-alpine

# Install Air for Hot-reload
RUN go install github.com/air-verse/air@latest

WORKDIR /app

# Copy the dependency files and resolve them inside the container
COPY go.mod ./
RUN go mod tidy

# Copy the rest of the code
COPY . .

# Tell Docker to start the app using 'air'
CMD ["air", "-c", ".air.toml"]
