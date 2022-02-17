FROM debian:jessie-slim
RUN sed -i '/jessie-updates/d' /etc/apt/sources.list
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y -qq curl clamav clamav-daemon clamav-freshclam wget gettext-base && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

ENV TINI_VERSION v0.19.0

RUN set -x \
    && curl -fSL "https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini" -o /usr/local/bin/tini \
    && chmod +x /usr/local/bin/tini

RUN mkdir /var/run/clamav && \
    chown clamav:clamav /var/run/clamav && \
    chmod 750 /var/run/clamav

EXPOSE 3310

ADD bootstrap.sh /
ADD clamd.conf.template /etc/clamav/
ADD freshclam.conf.template /etc/clamav/

RUN freshclam --verbose

ENV MAX_THREADS 12
ENV MAX_CONNECTION_QUEUE_LENGTH 15
ENV MAX_QUEUE=100
ENV MAX_SCAN_SIZE 100M
ENV MAX_FILE_SIZE 100M
ENV MAX_STREAM_LENGTH 100M

CMD ["/bootstrap.sh"]
