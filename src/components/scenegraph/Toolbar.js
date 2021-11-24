import classnames from 'classnames';
import React from 'react';
import Events from '../../lib/Events.js';
import { saveBlob, saveString } from '../../lib/utils';
import axios from 'axios';
require('dotenv').config();

const LOCALSTORAGE_MOCAP_UI = 'aframeinspectormocapuienabled';

function getCookie(name) {
  const r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
  return r ? r[1] : undefined;
}

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

export const updateObject = async(putUrl, object, objectId) => {
  axios.put(putUrl, object, {
    headers: {
        "Content-Type": "application/json",
        "X-Xsrftoken": getCookie("_xsrf"),
    }, withCredentials: true
  })
  .then(function (response) {
    alert("Updated object with id: " + objectId);
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

export const addObject = async(postUrl, object, refToToolbar) => {
  const objId = object.obj;
  delete object.obj;
  axios.post(postUrl, object, {
    headers: {
        "Content-Type": "application/json",
        "X-Xsrftoken": getCookie("_xsrf"),
    }, withCredentials: true
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

export const deleteObject = async(deleteUrl, objectId) => {
  axios.delete(deleteUrl, {
    headers: {
        "Content-Type": "application/json",
        "X-Xsrftoken": getCookie("_xsrf"),
    }, withCredentials: true
  })
  .then(function (response) {
    alert("Deleted object with id: " + objectId);
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

export const editBackground = async(sceneUrl, sceneBody, backgroundModelChanged=false) => {
  axios.put(sceneUrl, sceneBody, {
    headers: {
        "Content-Type": "application/json",
        "X-Xsrftoken": getCookie("_xsrf"),
      }, withCredentials: true
    })
  .then(function (response) {
    alert("Changes to the background were saved");
    // if background model changed, also need to update screenshot
    if(backgroundModelChanged){
      window.takeSceneScreenshot(response.data.s3_key);
    }
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
        </div>
      </div>
    );
  }
}
