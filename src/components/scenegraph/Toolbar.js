import classnames from 'classnames';
import React from 'react';
import Events from '../../lib/Events.js';
import { saveBlob, saveString } from '../../lib/utils';
import axios from 'axios';

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
  console.log(putUrl);
  axios.put(putUrl, object, {
      headers: {
          "Content-Type": "application/json",
      },
    })
    .catch((error) => {
        throw error;
    });
}

/**
 * Tools and actions.
 */
export default class Toolbar extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isPlaying: false
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

  addEntity() {
    Events.emit('entitycreate', { element: 'a-entity', components: {} });
  }

  /**
   * Try to write changes with aframe-inspector-watcher.
   */
  writeChanges = () => {
    const baseUrl = "http://localhost:8888/";
    const apiEndpointScene = "3";
    const apiEndpoint = "api/admin/v1/scene/";
    const getUrl = baseUrl + apiEndpoint + apiEndpointScene;
    let objects = [];
    let objectChanges = [];
    axios.get(getUrl, {
            headers: {
                "Content-Type": "application/json",
            },
        })
        .catch((error) => {
            throw error;
        })
        .then(function (response) {
          objects = response.data.objects;
          console.log(objects);
          for(var id in AFRAME.INSPECTOR.history.updates)
            objectChanges.push([parseInt(id.replace("-obj", "")), AFRAME.INSPECTOR.history.updates[id]]);
          objectChanges.sort();
          let i = 0;
          let j = 0;
          while(i < objects.length && j < objectChanges.length){
            if (objects[i].id == objectChanges[j][0]){
              let curChanges = objectChanges[j][1];
              for (const prop in curChanges){
                objects[i][prop] = curChanges[prop].split(" ").map(Number);
                const putUrl = getUrl + "/object/" + objects[i].id;
                delete objects[i].id;
                delete objects[i].asset_details;
                updateObject(putUrl, objects[i]);
              }
              j++;
            }
            i++;
          }
        });
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
