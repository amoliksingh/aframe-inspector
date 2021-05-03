import classnames from 'classnames';
import React from 'react';
import Events from '../../lib/Events.js';
import { saveBlob, saveString } from '../../lib/utils';
import axios from 'axios';
require('dotenv').config();

const LOCALSTORAGE_MOCAP_UI = 'aframeinspectormocapuienabled';

function filterHelpers(scene, visible) {
  scene.traverse(o => {
    if (o.userData.source === 'INSPECTOR') {
      o.visible = visible;
    }
  });
}

function getSceneName(scene) {
  return scene.id || slugify(window.location.host + window.location.pathname);
}

/**
 * Slugify the string removing non-word chars and spaces
 * @param  {string} text String to slugify
 * @return {string}      Slugified string
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '-') // Replace all non-word chars with -
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

async function updateObject(putUrl, object){
  axios.put(putUrl, object, {
      headers: {
          "Content-Type": "application/json",
      },
    })
    .catch((error) => {
      if (error.response){
        alert("URL: " + putUrl + "\nTitle: " + error.response.data.title + "\nMessage: " + error.response.data.message);
      } else if (error.request){
        alert("No response from URL: " + putUrl);
      } else{
        alert(error.message);
      }
    });
}

/**
 * Tools and actions.
 */
export default class Toolbar extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isPlaying: false,
      objects: [],
      linkToIdMap: null
    };
    this.getRequests(this);
  }

  getRequests(self){
    const baseUrl = process.env.REACT_APP_ADMIN_BACKEND_URL;
    const apiEndpointScene = AFRAME.scenes[0].getAttribute("id").replace("-scene", "");
    const baseEndpoint = process.env.REACT_APP_ADMIN_BASE_ENDPOINT;

    let getUrl = baseUrl + baseEndpoint + "scene/" + apiEndpointScene;
    axios.get(getUrl, {
        headers: {
            "Content-Type": "application/json",
        },
    })
    .catch((error) => {
      if (error.response){
        alert("URL: " + getUrl + "\nTitle: " + error.response.data.title + "\nMessage: " + error.response.data.message);
      } else if (error.request){
        alert("No response from URL: " + getUrl);
      } else{
        alert(error.message);
      }
    })
    .then(function (response) {
      let objects = response.data.objects;
      self.setState({ objects });
    });

    getUrl = baseUrl + baseEndpoint + "assets";
    axios.get(getUrl, {
        headers: {
            "Content-Type": "application/json",
        },
    })
    .catch((error) => {
      if (error.response){
        alert("URL: " + getUrl + "\nTitle: " + error.response.data.title + "\nMessage: " + error.response.data.message);
      } else if (error.request){
        alert("No response from URL: " + getUrl);
      } else{
        alert(error.message);
      }
    })
    .then(function (response) {
      let assets = response.data.assets;
      let linkToIdMap = new Map();
      assets.forEach(function( item, index) {
        linkToIdMap[baseUrl+"static/"+item.s3_key] = item.id;
      });
      self.setState({ linkToIdMap });
    });
  }

  exportSceneToGLTF() {
    ga('send', 'event', 'SceneGraph', 'exportGLTF');
    const sceneName = getSceneName(AFRAME.scenes[0]);
    const scene = AFRAME.scenes[0].object3D;
    filterHelpers(scene, false);
    AFRAME.INSPECTOR.exporters.gltf.parse(
      scene,
      function(buffer) {
        filterHelpers(scene, true);
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        saveBlob(blob, sceneName + '.glb');
      },
      { binary: true }
    );
  }

  addEntity() {
    Events.emit('entitycreate', { element: 'a-entity', components: {} });
  }

  /**
   * Try to write changes with aframe-inspector-watcher.
   */
  writeChanges = () => {
    const baseUrl = process.env.REACT_APP_ADMIN_BACKEND_URL;
    const apiEndpointScene = AFRAME.scenes[0].getAttribute("id").replace("-scene", "");
    const baseEndpoint = process.env.REACT_APP_ADMIN_BASE_ENDPOINT;
    const getUrl = baseUrl + baseEndpoint + "scene/" + apiEndpointScene;
    let objects = this.state.objects;
    let objectChanges = [];
    let changedObjectsString = "";
    for(var id in AFRAME.INSPECTOR.history.updates)
      objectChanges.push([parseInt(id.replace("-obj", "")), AFRAME.INSPECTOR.history.updates[id]]);
    objectChanges.sort();
    let i = 0;
    let j = 0;
    while(i < objects.length && j < objectChanges.length){
      if (objects[i].id == objectChanges[j][0]){
        let hasChanged = false;
        let curChanges = objectChanges[j][1];
        for (const prop in curChanges){
          if (prop == "position" || prop == "scale" || prop == "rotation"){
            const newPropArr = curChanges[prop].split(" ").map(Number);
            if (JSON.stringify(objects[i][prop]) != JSON.stringify(newPropArr)){
              hasChanged = true;
              objects[i][prop] = newPropArr;
            }
          } else if (prop == "gltf-model"){
            const newAssetId = this.state.linkToIdMap[curChanges[prop]];
            if (objects[i]["asset_id"] != newAssetId){
              hasChanged = true;
              objects[i]["asset_id"] = newAssetId;
            }
          }
        }
        if (hasChanged){
          changedObjectsString = changedObjectsString + " (" + objects[i].name  + ", id: " + objects[i].id + "),";
          const putUrl = getUrl + "/object/" + objects[i].id;
          const curId = objects[i].id;
          delete objects[i].id;
          delete objects[i].asset_details;
          updateObject(putUrl, objects[i]);
          objects[i].id = curId;
          this.setState({ objects });
          j++;
        }
      }
      i++;
    }
    if (changedObjectsString.length > 0){
      alert("Changes to the following objects were made: [" + changedObjectsString + " ] were saved");
    }
  };

  toggleScenePlaying = () => {
    if (this.state.isPlaying) {
      AFRAME.scenes[0].pause();
      this.setState({isPlaying: false});
      AFRAME.scenes[0].isPlaying = true;
      document.getElementById('aframeInspectorMouseCursor').play();
      return;
    }
    AFRAME.scenes[0].isPlaying = false;
    AFRAME.scenes[0].play();
    this.setState({isPlaying: true});
  }

  render() {
    const watcherClassNames = classnames({
      button: true,
      fa: true,
      'fa-save': true
    });
    const watcherTitle = 'Write changes with aframe-watcher.';

    return (
      <div id="toolbar">
        <div className="toolbarActions">
          <a
            className="button fa fa-plus"
            title="Add a new entity"
            onClick={this.addEntity}
          />
          <a
            id="playPauseScene"
            className={'button fa ' + (this.state.isPlaying ? 'fa-pause' : 'fa-play')}
            title={this.state.isPlaying ? 'Pause scene' : 'Resume scene'}
            onClick={this.toggleScenePlaying}>
          </a>
          <a
            className="gltfIcon"
            title="Export to GLTF"
            onClick={this.exportSceneToGLTF}>
            <img src={process.env.NODE_ENV === 'production' ? 'https://aframe.io/aframe-inspector/assets/gltf.svg' : '../assets/gltf.svg'} />
          </a>
          <a
            className={watcherClassNames}
            title={watcherTitle}
            onClick={this.writeChanges}
          />
        </div>
      </div>
    );
  }
}
