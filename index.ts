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

dotenv.config()

declare var log: any
const globalAny: any = global

globalAny.log = logger()

program
  .option("-d, --debug", "debug mode")
  .command("convert <article>", "convert article from hugo, and add it as draft to wordpress")
  .option("-l, --live", "Actually push to wordpress")
  .action((cmd, options) => {
    if (program.debug) {
      log.setLevel("debug")
      log.debug("Turning on debug mode.")
    }
    try {
      const hugoArticle = new HugoArticle({ filename: cmd })
      hugoArticle.load()
      const wordpressArticle = new WordpressArticle({ hugoArticle, ...options })
      wordpressArticle.push()
    } catch (err) {
      log.error(err)
    }
  })
  .parse(process.argv)
