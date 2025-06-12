const fs = require('fs');
const path = require('path');
const os = require('os');

class Config {
  constructor() {
    // 현재 작업 디렉토리의 supabase/dumps 폴더에 설정 파일 저장
    this.configPath = path.join(process.cwd(), 'supabase', 'dumps');
    this.configFile = path.join(this.configPath, 'backup-config.json');
    this.config = {};
    this.initDefaults();
  }

  initDefaults() {
    const defaults = {
      cloud: {
        url: '',
        password: ''
      },
      local: {
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        database: 'postgres',
        password: ''
      },
      backup: {
        dumpDir: `${process.cwd()}/supabase/dumps`
      }
    };

    // 설정 파일을 로드하거나 기본값으로 초기화
    this.loadConfig();
    
    // 기본값 설정 (기존 값이 없는 경우에만)
    Object.keys(defaults).forEach(section => {
      if (!this.config[section]) {
        this.config[section] = defaults[section];
      }
    });
  }

  loadConfig() {
    try {
      if (!fs.existsSync(this.configPath)) {
        fs.mkdirSync(this.configPath, { recursive: true });
      }
      
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8');
        this.config = JSON.parse(data);
      } else {
        this.config = {};
      }
    } catch (error) {
      // 파일이 존재하지 않거나 파싱 오류 시 빈 설정으로 시작
      this.config = {};
    }
  }

  // 클라우드 DB 설정
  setCloudConfig(url, password) {
    if (!this.config.cloud) this.config.cloud = {};
    this.config.cloud.url = url;
    this.config.cloud.password = password;
    this.save();
  }

  getCloudConfig() {
    return {
      url: this.config.cloud?.url || '',
      password: this.config.cloud?.password || ''
    };
  }

  // 로컬 DB 설정
  setLocalConfig(host, port, user, database, password) {
    if (!this.config.local) this.config.local = {};
    this.config.local.host = host;
    this.config.local.port = port;
    this.config.local.user = user;
    this.config.local.database = database;
    this.config.local.password = password;
    this.save();
  }

  getLocalConfig() {
    return {
      host: this.config.local?.host || 'localhost',
      port: this.config.local?.port || 5432,
      user: this.config.local?.user || 'postgres',
      database: this.config.local?.database || 'postgres',
      password: this.config.local?.password || ''
    };
  }

  // 백업 설정
  setBackupConfig(dumpDir) {
    if (!this.config.backup) this.config.backup = {};
    this.config.backup.dumpDir = dumpDir;
    this.save();
  }

  getBackupConfig() {
    return {
      dumpDir: this.config.backup?.dumpDir || './supabase/dumps'
    };
  }

  // 전체 설정 가져오기
  getAllConfig() {
    return {
      cloud: this.getCloudConfig(),
      local: this.getLocalConfig(),
      backup: this.getBackupConfig()
    };
  }

  // 설정 저장
  save() {
    try {
      if (!fs.existsSync(this.configPath)) {
        fs.mkdirSync(this.configPath, { recursive: true });
      }
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('Failed to save config:', error);
      return false;
    }
  }

  // 설정 파일 경로 반환
  getConfigPath() {
    return this.configPath;
  }

  // 설정 유효성 검사
  validateCloudConfig() {
    const config = this.getCloudConfig();
    return config.url && config.password && config.url.includes('supabase.com');
  }

  validateLocalConfig() {
    const config = this.getLocalConfig();
    return config.host && config.port && config.user && config.database;
  }

  // 클라우드 DB URL에서 정보 추출
  parseCloudUrl(url) {
    try {
      const urlObj = new URL(url);
      const host = urlObj.hostname;
      const port = urlObj.port || 5432;
      const database = urlObj.pathname.substring(1) || 'postgres';
      const user = urlObj.username || 'postgres';
      
      return {
        host,
        port: parseInt(port),
        user,
        database,
        isSupabase: host.includes('supabase.com')
      };
    } catch (error) {
      return null;
    }
  }
}

module.exports = new Config();