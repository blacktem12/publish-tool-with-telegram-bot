const JSZip = require("jszip");
const fsExtra = require('fs-extra');
const logger = require('./logger');
const octokit = require('./github-helper');
const { execSync } = require('child_process');

const repositoryName = 'Git Repository Name';
const downloadPath = '/data/download';
const buildPath = `${downloadPath}/frontend/dist`;

const publishFolderPath = {
  main: {
    backend: '/data/backend',
    frontend: '/data/www'
  },
  development: {
    backend: '/data/backend',
    frontend: '/data/www'
  },
  release: {
    backend: '/data/release/backend',
    frontend: '/data/release'
  }
};

module.exports = class PublishManager {
  /**
   * 실질적인 배포를 담당한다.
   * @param {string} branchName 배포하고자 하는 repository > branch 이름.
   * @param {string} targetFolderName 배포하고자 하는 branch의 최상위 folder 이름. frontend, backend, both
   */
  constructor(branchName, targetFolderName, isUpdate) {
    this.branchPath = repositoryName;
    this.branchName = branchName;
    this.targetFolderName = targetFolderName;

    this.downloadPath = downloadPath;
    this.publishFolderPath = publishFolderPath[this.branchName];
    this.buildPath = buildPath;
    this.isBoth = targetFolderName == 'both';
    this.isUpdate = isUpdate != undefined;

    this.initWorkingFolder();
  }

  initWorkingFolder() {
    if (this.isBoth) {
      fsExtra.emptyDirSync(this.publishFolderPath.frontend);
      fsExtra.emptyDirSync(this.publishFolderPath.backend);
    } else {
      fsExtra.emptyDirSync(this.publishFolderPath[this.targetFolderName]);
    }

    if (fsExtra.existsSync(this.downloadPath)) {
      fsExtra.removeSync(this.downloadPath);
    }
  }

  downloadBranch() {
    return new Promise((resolve, reject) => {
      try {
        if ((this.isBoth || this.targetFolderName == 'frontend') && !fsExtra.existsSync(this.downloadPath)) {
          fsExtra.mkdirSync(this.downloadPath);
        }

        octokit.request('GET /repos/{owner}/{repo}/zipball/{ref}', { owner: 'Owner', repo: this.branchPath, ref: this.branchName }).then((response) => {
          let folderName = response.headers['content-disposition'].split('filename=')[1].replace('.zip', '/');
          let promises = [];

          const jsZip = new JSZip();

          jsZip.loadAsync(response.data).then((contents) => {
            const files = contents.files;
            const fileNames = Object.keys(files);

            for (let i = 0; i < fileNames.length; i++) {
              let entry = files[fileNames[i]];
      
              if (entry.name != folderName && entry.name.indexOf('.vscode/') < 0) {
                let promise = null;

                if (this.isBoth) {
                  promise = this.#createBothFile(folderName, entry, reject);
                } else if (this.targetFolderName == 'frontend') {
                  promise = this.#createFrontendFile(folderName, entry, reject);
                } else {
                  promise = this.#createBackendFile(folderName, entry, reject);
                }

                if (promise != null) {
                  promises.push(promise);
                }
              }
            }

            Promise.all(promises).then(() => {
              resolve('Done');
            });
          }).catch(error => {
            reject(error);

            logger.log('error', error);
          })
        }).catch(error => {
          reject(error);

          logger.log('error', error);
        })
      } catch (e) {
        reject(e);

        logger.log('error', e);
      }
    });
  }

  installProject() {
    return new Promise((resolve, reject) => {
      if (this.isBoth) {
        this.#installBackend(reject);
        this.#installFrontend(reject);
      } else if (this.targetFolderName == 'frontend') {
        this.#installFrontend(reject);
      } else {
        this.#installBackend(reject);
      }

      resolve('Done');
    });
  }

  #createBothFile(folderName, entry, reject) {
    // Frontend는 우선 build를 진행해야 하므로, 임시로 다운로드 폴더에 파일을 생성한다. Backend의 경우 대상 폴더에 바로 다운로드 한다.
    let rootPath = entry.name.indexOf(`${folderName}frontend`) > -1 ? this.downloadPath : this.publishFolderPath.backend.replace('/backend', '');
    let path = `${rootPath}/${entry.name.replace(`${folderName}`, '')}`;

    if (entry.dir) {
      if (!fsExtra.existsSync(path)) {
        fsExtra.mkdirSync(path);
      }

      return null;
    } else {
      return entry.async('uint8array').then((file) => {
        fsExtra.writeFileSync(path, file);
      })
      .catch(error => {
        reject(error);
      });
    }
  }

  #createFrontendFile(folderName, entry, reject) {
    if (entry.name.indexOf(`${folderName}frontend/`) == -1) {
      return null;
    }

    // Frontend는 우선 build를 진행해야 하므로, 임시로 다운로드 폴더에 파일을 생성한다. Backend의 경우 대상 폴더에 바로 다운로드 한다.
    let path = `${this.downloadPath}/${entry.name.replace(`${folderName}`, '')}`;

    if (entry.dir) {
      if (!fsExtra.existsSync(path)) {
        fsExtra.mkdirSync(path);
      }

      return null;
    } else {
      return entry.async('uint8array').then((file) => {
        fsExtra.writeFileSync(path, file);
      })
      .catch(error => {
        reject(error);
      });
    }
  }

  #createBackendFile(folderName, entry, reject) {
    if (entry.name.indexOf(`${folderName}backend/`) == -1) {
      return null;
    }

    // Frontend는 우선 build를 진행해야 하므로, 임시로 다운로드 폴더에 파일을 생성한다. Backend의 경우 대상 폴더에 바로 다운로드 한다.
    let path = `${this.publishFolderPath.backend.replace('/backend', '')}/${entry.name.replace(`${folderName}`, '')}`;

    if (entry.dir) {
      if (!fsExtra.existsSync(path)) {
        fsExtra.mkdirSync(path);
      }

      return null;
    } else {
      return entry.async('uint8array').then((file) => {
        fsExtra.writeFileSync(path, file);
      })
      .catch(error => {
        reject(error);
      });
    }
  }

  #installBackend(reject) {
    try {
      let script = 'yarn install';

      if (this.isUpdate) {
        script = 'yarn install && yarn upgrade';
      }

      execSync(script, { cwd: this.publishFolderPath.backend, encoding: 'utf8', maxBuffer: 1024 * 1024 });
    } catch (e) {
      logger.log('error', e);

      reject(e);
    }
  }

  #installFrontend() {
    try {
      const mode = this.branchName == 'main' ? 'prod' : 'dev';
      const cwd = `${this.downloadPath}/frontend`;
      let script = `yarn install && yarn run build:${mode}`;

      if (this.isUpdate) {
        script = `yarn install && yarn upgrade && yarn run build:${mode}`;
      }

      execSync(script, { cwd: cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 });
      
      fsExtra.copySync(`${this.buildPath}`, this.publishFolderPath.frontend);

      fsExtra.removeSync(this.downloadPath);
    } catch (e) {
      logger.log('error', e);

      reject(e);
    }
  }
}