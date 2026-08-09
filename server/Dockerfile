FROM node:20

RUN apt-get update && \
apt-get install -y \
texlive-latex-base \
texlive-latex-recommended \
texlive-latex-extra \
texlive-fonts-recommended \
texlive-fonts-extra \
texlive-lang-english \
latexmk \
fontconfig \
&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Create required folders
RUN mkdir -p uploads generated

EXPOSE 5000

CMD ["node", "index.js"]