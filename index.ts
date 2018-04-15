import dotenv from "dotenv"
import fs from "fs"

import * as _ from "lodash"
import logger from "loglevel-colored-level-prefix"
import path from "path"
import request from "request-promise-native"
import util from "util"

import HugoArticle from "./src/hugoArticle"
import WordpressArticle from "./src/wordpressArticle"

const log = logger()
log.setLevel("debug")
dotenv.config()

async function main(): Promise<any> {
  try {
    const hugoArticle = new HugoArticle({ filename: process.argv[2] })
    hugoArticle.load()
    const wordpressArticle = new WordpressArticle(hugoArticle)
    wordpressArticle.push()
  } catch (err) {
    log.error(err)
  }
}

main()
