import dotenv from "dotenv"
import fs from "fs"

import * as _ from "lodash"
import logger from "loglevel-colored-level-prefix"
import path from "path"
import request from "request-promise-native"
import util from "util"

import HugoArticle from "./src/hugoArticle"
import WordpressArticle from "./src/wordpressArticle"

import program from "commander"

const log = logger()
log.setLevel("debug")
dotenv.config()

program
  .option("-d, --debug", "debug mode")
  .command("convert <article.md>", "convert article from hugo, and add it as draft to wordpress")
  .action(function(cmd, env) {
    try {
      const hugoArticle = new HugoArticle({ filename: process.argv[2] })
      hugoArticle.load()
      const wordpressArticle = new WordpressArticle({ hugoArticle })
      wordpressArticle.push()
    } catch (err) {
      log.error(err)
    }
  })
  .parse(process.argv)
