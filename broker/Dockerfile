FROM docker.m.daocloud.io/eclipse-mosquitto:2

COPY mosquitto.conf /mosquitto/config/mosquitto.conf
COPY aclfile /mosquitto/config/aclfile
COPY start-broker.sh /usr/local/bin/start-broker.sh

EXPOSE 9001 1883

CMD ["sh", "/usr/local/bin/start-broker.sh"]
