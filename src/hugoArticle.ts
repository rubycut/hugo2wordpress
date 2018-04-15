class HugoArticle {
  private slug: string;
  private content: string;
  private mdFilename: string;
  private categories: string[];
  private tags: string[];
  constructor(options) {
    this.mdFilename = options.filename;
    this.categories = [];
    this.tags = [];
    this.content = "";
    this.slug = "";
  }
  public load() {
    // TODO SUPPORT MULTIPLE FILES
    const filename = this.filename();
    // Get document, or throw exception on error
    const file = fs.readFileSync(filename, "utf8");
    const myYaml = file.split("---")[1];
    try {
      this.yaml = yaml.safeLoad(myYaml);
      this.slug = path.basename(filename).split(".")[0];
      const text = file.split("---");
      // remove first empty member
      text.shift();
      // remove yaml
      text.shift();
      // take the rest
      this.content = text.join("---");
      log.debug(this);
    } catch (e) {
      log.error(e);
    }
  }

  private filename(): string {
    return `${process.env.HUGO_HOME}/content/` + this.mdFilename;
  }
}
