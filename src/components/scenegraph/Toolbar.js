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

async function addObject(postUrl, object, refToToolbar){
  const objId = object.obj;
  delete object.obj;
  axios.post(postUrl, object, {
    headers: {
        "Content-Type": "application/json",
    },
  })
  .then(function (response) {
    let newObjectId = response.data.id;
    let objects = refToToolbar.state.objects;
    object["id"] = newObjectId;
    objects.push(object);
    refToToolbar.setState({ objects });
    alert("Added new object with name: " + object.name + ", id: " + newObjectId);
    let entity = document.getElementById(objId);
    entity.id = newObjectId+"-obj";
    Events.emit('entityidchange', entity);
  })
  .catch((error) => {
    if (error.response){
      alert("URL: " + postUrl + "\nTitle: " + error.response.data.title + "\nMessage: " + error.response.data.message);
    } else if (error.request){
      alert("No response from URL: " + postUrl);
    } else{
      alert(error.message);
    }
  });
}

async function deleteObject(deleteUrl){
  axios.delete(deleteUrl, {
    headers: {
        "Content-Type": "application/json",
    },
  })
  .catch((error) => {
    if (error.response){
      alert("URL: " + deleteUrl + "\nTitle: " + error.response.data.title + "\nMessage: " + error.response.data.message);
    } else if (error.request){
      alert("No response from URL: " + deleteUrl);
    } else{
      alert(error.message);
    }
  });
}

async function editBackground(sceneUrl, sceneBody){
  axios.put(sceneUrl, sceneBody, {
    headers: {
        "Content-Type": "application/json",
    },
  })
  .then(function (response) {
    alert("Changes to the background were saved");
  })
  .catch((error) => {
    if (error.response){
      alert("URL: " + sceneUrl + "\nTitle: " + error.response.data.title + "\nMessage: " + error.response.data.message);
    } else if (error.request){
      alert("No response from URL: " + sceneUrl);
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
      linkToIdMap: null,
      sceneBody: null
    };
    this.getRequests(this);
  }

  getRequests(self){
    const baseUrl = process.env.REACT_APP_ADMIN_BACKEND_URL;
    const apiEndpointScene = AFRAME.scenes[0].getAttribute("id").replace("-scene", "");
    const baseEndpoint = process.env.REACT_APP_ADMIN_BASE_ENDPOINT;
    const assetsUrl = process.env.REACT_APP_ADMIN_ASSET_PREFIX_URL;

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
      let sceneBody = response.data;
      delete sceneBody.objects;
      delete sceneBody.background_details;
      delete sceneBody.id;
      delete sceneBody.hints;
      delete sceneBody.object_ids;
      self.setState({ objects, sceneBody });
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
        linkToIdMap[assetsUrl+item.s3_key] = item.id;
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
    let deletedObjectsString = "";

    for(var id in AFRAME.INSPECTOR.history.updates){
      if (id.endsWith("-background")){
        let sceneBody = this.state.sceneBody;
        let hasChanged = false;
        const changes = AFRAME.INSPECTOR.history.updates[id];
        for (const prop in changes){
          if (prop == "position" || prop == "scale" || prop == "rotation"){
            const newPropArr = changes[prop].split(" ").map(Number);
            if (JSON.stringify(sceneBody[prop]) != JSON.stringify(newPropArr)){
              hasChanged = true;
              sceneBody[prop] = newPropArr;
            }
          } else if (prop == "gltf-model"){
            const newAssetId = this.state.linkToIdMap[changes[prop]];
            if (sceneBody["background_id"] != newAssetId){
              hasChanged = true;
              sceneBody["background_id"] = newAssetId;
            }
          }
        }
        if (hasChanged){
          this.setState({ sceneBody });
          editBackground(getUrl, sceneBody);
        }
      } else if (id.endsWith("-obj")){
        if ("delete" in AFRAME.INSPECTOR.history.updates[id]){
          if (deletedObjectsString == ""){
            deletedObjectsString = id.replace("-obj", "");
          } else{
            deletedObjectsString = deletedObjectsString + ", " + id.replace("-obj", "");
          }
          const deleteUrl = baseUrl + baseEndpoint + "scene/" + apiEndpointScene + "/object/" + id.replace("-obj", "");
          deleteObject(deleteUrl);
        } else{
          objectChanges.push([parseInt(id.replace("-obj", "")), AFRAME.INSPECTOR.history.updates[id]]);
        }
      } else if (id.includes("@")) {
        const objName = id.split("@")[0];
        if (!("gltf-model" in AFRAME.INSPECTOR.history.updates[id]) || AFRAME.INSPECTOR.history.updates[id]['gltf-model'] == ""){
          alert("Error: Save failed, Please provide gltf-model for object with name: " + id);
          return;
        } else{
          let basicObject = {
            "position": [0.0, 0.0, 0.0],
            "scale": [1.0, 1.0, 1.0],
            "rotation": [0.0, 0.0, 0.0],
            "name": objName,
            "asset_id": 1,
            "next_objects": [
              {
                "id": 2,
                "action": {
                  "type": "text",
                  "text_id": 1
                }
              }
            ],
            "is_interactable": false
          }
          let curChanges = AFRAME.INSPECTOR.history.updates[id];
          for (const prop in curChanges){
            if (prop == "position" || prop == "scale" || prop == "rotation"){
              basicObject[prop] = curChanges[prop].split(" ").map(Number);
            } else if (prop == "gltf-model"){
              basicObject["asset_id"] = this.state.linkToIdMap[curChanges[prop]];
            }
          }
          const postUrl = getUrl + "/object";
          basicObject.obj = id;
          addObject(postUrl, basicObject, this);
        }
        // here is where we want to create a new object
        // first strip the name's suffix (<>-!) - make sure to save the suffix
        // POST request to backend - this endpoint returns the entire object JSON
        // backend will return an id for the newly created object
        // We have this: AFRAME.INSPECTOR.history.updates["name"<>-!suffix] = changes
        // We update this to be AFRAME.INSPECTOR.history.updates["returned_id"-obj] = changes
        // Add this new object to objects: 1. add it manually, OR 2. make a get request to scene/objects
        // var entity = document.getElementById("name"<>-!suffix);
        // Update entity ID - commoncomponents.js method updateID
        // error handling to make sure it has a gltf-model
      }
    }
    for (var id in AFRAME.INSPECTOR.history.updates){
      delete AFRAME.INSPECTOR.history.updates[id];
    }

    if (deletedObjectsString.length > 0){
      alert("The objects with the following ids were deleted: [ " + deletedObjectsString + " ]");
    }

    objectChanges.sort();
    objects.sort((a,b) => a.id - b.id);

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
        }
        j++;
      }
      i++;
    }
    this.setState({ objects });
    
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
