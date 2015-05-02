'use strict';

import { Store } from 'flummox';
import Immutable from 'immutable';

const defaultValues = require('../../config_settings.json');

export class ConfigStore extends Store {
  constructor(flux) {
    super();

    this.state = { settings: Immutable.fromJS(this.configDecorator(this.getDefaultValues()))};

    /*
     Registering action handlers
     */

    const configActionIds = flux.getActionIds('config');

    this.register(configActionIds.saveSettings, this.saveSettings);
    this.register(configActionIds.clearAllData, this.clearAllData);

    this.overrideByPersistedData();
  }

  async overrideByPersistedData() {
    let result = await this.getPersistedData();
    const savedConfig = result.reduce((previous, current) => {
      previous[current.key] = current.value;
      return previous;
    }, {});
    if (savedConfig.slug && savedConfig.apiendpoint && savedConfig.webendpoint) {
      this.setState({ settings: Immutable.fromJS(this.configDecorator(savedConfig)) });
    }
  }

  async getPersistedData() {
    let db = await window.closeyourissues.db.connect();
    let configTables = await db.getSchema().table('Configs');
    let results = await db.select().from(configTables).exec();
    return results;
  }

  clearAllData() {
    this.setState({ settings: Immutable.fromJS(this.configDecorator(this.getDefaultValues())) });

    // http://stackoverflow.com/questions/15861630/how-can-i-remove-a-whole-indexeddb-database-from-javascript
    let req = indexedDB.deleteDatabase('close_your_issues');
    req.onsuccess = () => {
      console.log("Deleted database successfully");
    };
    req.onerror = () => {
      console.log("Couldn't delete database");
    };
    req.onblocked = () => {
      console.log("Couldn't delete database due to the operation being blocked");
    };
  }

  async persistParams(params) {
    let db = await window.closeyourissues.db.connect();
    let configTables = await db.getSchema().table('Configs');
    await db.delete().from(configTables).exec();

    let rows = Object.keys(params).reduce((previous, current) => {
      previous.push(
        configTables.createRow({
          key: current,
          value: params[current]
        })
      );
      return previous;
    }, []);
    return await db.insertOrReplace().into(configTables).values(rows).exec();
  }

  async saveSettings(settings) {
    let params = this.convertSettings(settings);
    this.setState({ settings: Immutable.fromJS(this.configDecorator(params)) });
    await this.persistParams(params);
  }

  convertSettings(settings) {
    const copied = Object.assign({}, settings);
    return {
      apiendpoint: this.removeTrailingSlash(copied.apiEndpoint),
      webendpoint: this.removeTrailingSlash(copied.webEndpoint),
      token: copied.accessToken,
      slug: this.removeTrailingSlash(copied.slug)
    };
  }

  getSettings() {
    return this.state.settings;
  }

  getDefaultValues() {
    return Object.assign({}, defaultValues);
  }
  removeTrailingSlash(string) {
    if(typeof string !== 'string') {
      return string;
    }
    return string.replace(/\/+$/, '');
  }
  configDecorator(jsObject) {
    let copied = Object.assign({}, jsObject);
    copied.tokenurl = `${copied.webendpoint}/settings/tokens/new`;
    return copied;
  }
}
