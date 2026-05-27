#ddev-generated
ARG BASE_IMAGE=ubuntu:24.04
FROM ${BASE_IMAGE}

ARG USERNAME=pi
ARG USER_UID=1000
ARG USER_GID=1000
ARG PI_VERSION=latest

ENV DEBIAN_FRONTEND=noninteractive
ENV USERNAME=${USERNAME}
ENV USER_HOME=/home/${USERNAME}

USER root

# Install base dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ripgrep \
       fd-find \
       ca-certificates \
       curl \
       openssh-client \
       sudo \
    && ln -sf /usr/bin/fdfind /usr/local/bin/fd \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js LTS via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create user with matching UID/GID from host
RUN existing_user=$(getent passwd ${USER_UID} | cut -d: -f1) \
    && existing_group=$(getent group ${USER_GID} | cut -d: -f1) \
    && if [ -n "$existing_user" ] && [ "$existing_user" != "${USERNAME}" ]; then \
         userdel -r $existing_user 2>/dev/null || true; \
       fi \
    && if [ -n "$existing_group" ] && [ "$existing_group" != "${USERNAME}" ]; then \
         groupdel $existing_group 2>/dev/null || true; \
       fi \
    && groupadd --gid ${USER_GID} ${USERNAME} 2>/dev/null || true \
    && useradd --uid ${USER_UID} --gid ${USER_GID} -m -s /bin/bash ${USERNAME} 2>/dev/null || true \
    && echo "${USERNAME} ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/${USERNAME} \
    && chmod 0440 /etc/sudoers.d/${USERNAME} \
    && passwd -d ${USERNAME}

# Set up SSH client directory and config
RUN mkdir -p ${USER_HOME}/.ssh \
    && chown ${USER_UID}:${USER_GID} ${USER_HOME}/.ssh \
    && chmod 700 ${USER_HOME}/.ssh

COPY ssh-config ${USER_HOME}/.ssh/config
RUN chmod 600 ${USER_HOME}/.ssh/config \
    && chown ${USER_UID}:${USER_GID} ${USER_HOME}/.ssh/config

# Set up npm global and pi agent directories
RUN mkdir -p ${USER_HOME}/.npm-global \
    && mkdir -p ${USER_HOME}/.pi/agent/bin \
    && chown -R ${USER_UID}:${USER_GID} ${USER_HOME}/.npm-global \
    && chown -R ${USER_UID}:${USER_GID} ${USER_HOME}/.pi

# Copy and register entrypoint (as root, before USER switch)
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER ${USERNAME}
WORKDIR ${USER_HOME}

ENV HOME=${USER_HOME}
ENV NPM_CONFIG_PREFIX=${USER_HOME}/.npm-global
ENV PATH=${USER_HOME}/.npm-global/bin:$PATH

RUN npm_config_update_notifier=false npm install -g --ignore-scripts @earendil-works/pi-coding-agent@${PI_VERSION}

# Pi's built-in Bash tool does not load these ~/.bashrc aliases and functions,
# so they are mainly for interactive use inside the PI container. They are still
# useful for manual SSH-based connectivity checks against the web container.
RUN echo 'export PATH="${HOME}/.npm-global/bin:${HOME}/go/bin:$PATH"' >> ~/.bashrc \
    && echo 'alias ll="ls -la"' >> ~/.bashrc \
    && echo '' >> ~/.bashrc \
    && echo '# Safe SSH command wrapper — preserves quoting across SSH' >> ~/.bashrc \
    && echo 'ssh-cmd() { local host="$1"; shift; local cmd=""; for arg in "$@"; do cmd="${cmd:+$cmd }$(printf "%q" "$arg")"; done; ssh "$host" "$cmd"; }' >> ~/.bashrc \
    && echo '' >> ~/.bashrc \
    && echo '# Helper functions to execute in web container via SSH' >> ~/.bashrc \
    && echo 'web-exec() { ssh-cmd web "$@"; }' >> ~/.bashrc \
    && echo 'drush() { ssh-cmd web ./vendor/bin/drush "$@"; }' >> ~/.bashrc \
    && echo 'composer() { ssh-cmd web composer "$@"; }' >> ~/.bashrc \
    && echo 'phpunit() { ssh-cmd web ./vendor/bin/phpunit "$@"; }' >> ~/.bashrc \
    && echo 'phpstan() { ssh-cmd web ./vendor/bin/phpstan "$@"; }' >> ~/.bashrc \
    && echo 'web-shell() { ssh -t web bash; }' >> ~/.bashrc \
    && echo '' >> ~/.bashrc \
    && echo 'echo "Pi container ready"' >> ~/.bashrc \
    && echo 'echo "   Site URL: $DDEV_PRIMARY_URL"' >> ~/.bashrc \
    && echo '' >> ~/.bashrc \
    && echo 'echo "Commands: drush | composer | phpunit | phpstan | web-shell"' >> ~/.bashrc \
    && echo '' >> ~/.bashrc

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

WORKDIR /var/www/html
