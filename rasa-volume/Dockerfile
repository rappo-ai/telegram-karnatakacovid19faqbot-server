FROM rasa/rasa
WORKDIR /app
COPY . .
RUN ["rasa", "train", "-vv"]
EXPOSE 5005
CMD ["rasa", "run", "--enable-api", "-vv", "--log-file", "/app/run_logs.txt"]
