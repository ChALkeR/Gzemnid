'use strict';

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const JSONStream = require('JSONStream');
const readline = require('readline');
const path = require('path');
const config = require('../config').config;

function readlines(file) {
  return new Promise((accept, reject) => {
    const lines = [];
    const stream = fs.createReadStream(file);
    readline.createInterface({
      input: stream
    }).on('line', line => {
      if (line.length > 0)
        lines.push(line);
    });
    stream
      .on('end', () => accept(lines))
      .on('error', reject);
  });
}

function toMap(arr, value = false) {
  const map = new Map();
  arr.forEach(x => map.set(x, value));
  return map;
}

function toSet(arr) {
  const set = new Set();
  arr.forEach(x => set.add(x));
  return set;
}

async function run() {
  const broken = toSet(await readlines(path.join(config.basedir, 'data/brokenurls.txt')));
  const blacklist = toSet(await readlines(path.join(config.basedir, 'data/blacklist.txt')));
  const current = await fs.readdirAsync(path.join(config.dir, 'current/'));
  const current_ex = await fs.readdirAsync(path.join(config.dir, 'current.ex/'));
  const map = toMap(current);
  const map_ex = toMap(current_ex);

  if (current.join(',') !== current_ex.join(',')) {
    console.log('Warning: current and current.ex are not synced!');
  }

  const out = {
    mv_ex: fs.createWriteStream(path.join(config.dir, 'update.mv.ex.txt')),
    mv: fs.createWriteStream(path.join(config.dir, 'update.mv.txt')),
    rm_ex: fs.createWriteStream(path.join(config.dir, 'update.rm.ex.txt')),
    rm: fs.createWriteStream(path.join(config.dir, 'update.rm.txt')),
    download: fs.createWriteStream(path.join(config.dir, 'update.download.txt')),
    wget: fs.createWriteStream(path.join(config.dir, 'update.wget.txt'))
  };

  let count = 0;
  let updated = 0;
  const stream = fs.createReadStream(path.join(config.dir, 'byField.info.json')).pipe(JSONStream.parse('*'));
  stream.on('data', info => {
    if (!info.tar) {
      console.log(info.id + ': no tar!');
      return;
    }

    const url = info.tar.replace('http://', 'https://').replace('registry.npmjs.org', 'registry.npmjs.com');
    const file = url.replace('https://registry.npmjs.com/' + info.name + '/-/', '');

    if (file.replace(/[@0v-]/g, '') !== info.id.replace(/[@0v-]/g, '') + '.tgz') {
      console.log(`${info.id}: bad tar - ${info.tar}`);
      return;
    }
    if (broken.has(url)) {
      //console.log(`${info.id}: known broken url, tar - ${info.tar}`);
      return;
    }
    if (blacklist.has(file) || blacklist.has(url) || blacklist.has(info.id) || file.endsWith('-0.0.0-reserved.tgz')) {
      //console.log(`${info.id}: blacklist hit, tar - ${info.tar}`);
      return;
    }
    if (!map.has(file)) {
      out.download.write(`${url}\n`);
      out.wget.write(`wget -nc ${url}\n`);
      updated++;
    }

    map.set(file, true);
    map_ex.set(file, true);
    count++;
    if (count % 10000 === 0) {
      console.log(`${count}...`);
    }
  });

  stream.on('end', () => {
    console.log(`Total: ${count}.`);
    console.log(`New/updated: ${updated}.`);
    let moved = 0;
    map.forEach((status, file) => {
      if (status === false) {
        out.mv.write(`mv "${file}" ../outdated/\n`);
        out.rm.write(`rm "${file}" ../outdated/\n`);
        moved++;
      }
    });
    map_ex.forEach((status, file) => {
      if (status === false) {
        out.mv_ex.write(`mv "${file}" ../outdated.ex/\n`);
        out.rm_ex.write(`rm -rf "${file}" ../outdated.ex/\n`);
      }
    });
    console.log(`Moved: ${moved}.`);
    console.log('END');
  });
}

module.exports = {
  run
};