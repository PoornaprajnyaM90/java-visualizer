# Stage 1: build the JDI tracer jar
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /t
COPY tracer/pom.xml .
COPY tracer/src ./src
RUN mvn -q -DskipTests package

# Stage 2: minimal runtime (needs a JDK: javac + JDI)
FROM eclipse-temurin:21-jdk
RUN useradd -u 10001 -M -s /usr/sbin/nologin runner
COPY --from=build /t/target/tracer.jar /opt/tracer.jar
USER 10001
WORKDIR /work
