import classnames from 'classnames';
import axios from 'axios';
var React = require('react');
var Events = require('../../lib/Events.js');
var classNames = require('classnames');

var TransformButtons = [
  { value: 'translate', icon: 'fa-arrows-alt' },
  { value: 'scale', icon: 'fa-expand' },
  { value: 'rotate', icon: 'fa-repeat' }
];

function getCookie(name) {
  const r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
  return r ? r[1] : undefined;
}

async function updateObject(putUrl, object, objectId){
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

async function addObject(postUrl, object, refToToolbar){
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

async function deleteObject(deleteUrl, objectId){
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

async function editBackground(sceneUrl, sceneBody, backgroundModelChanged=false){
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

export default class TransformToolbar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedTransform: 'translate',
      localSpace: false,
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
      delete sceneBody.screenshot_url;
      delete sceneBody.s3_key;
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

  writeChanges = () => {
    const baseUrl = process.env.REACT_APP_ADMIN_BACKEND_URL;
    const apiEndpointScene = AFRAME.scenes[0].getAttribute("id").replace("-scene", "");
    const baseEndpoint = process.env.REACT_APP_ADMIN_BASE_ENDPOINT;
    const getUrl = baseUrl + baseEndpoint + "scene/" + apiEndpointScene;
    let objects = this.state.objects;
    let objectChanges = [];

    // validation of changes
    for(var id in AFRAME.INSPECTOR.history.updates){
      if (id.includes("@")) {
        if (!("gltf-model" in AFRAME.INSPECTOR.history.updates[id]) || AFRAME.INSPECTOR.history.updates[id]['gltf-model'] == ""){
          alert("Error: Save failed, Please provide gltf-model for object with name: " + id + "\nNo changes were made, please fix errors before saving");
          return;
        }
      }
    }

    // perform changes / add changes to objectChanges object
    for(var id in AFRAME.INSPECTOR.history.updates){
      if (id.endsWith("-background")){
        let sceneBody = this.state.sceneBody;
        let hasChanged = false;
        let backgroundModelChanged = false;
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
              backgroundModelChanged = true;
              sceneBody["background_id"] = newAssetId;
            }
          }
        }
        if (hasChanged){
          this.setState({ sceneBody });
          editBackground(getUrl, sceneBody, backgroundModelChanged);
        }
      } else if (id.endsWith("-obj")){
        if ("delete" in AFRAME.INSPECTOR.history.updates[id]){
          const deleteUrl = baseUrl + baseEndpoint + "scene/" + apiEndpointScene + "/object/" + id.replace("-obj", "");
          deleteObject(deleteUrl, id.replace("-obj", ""));
        } else{
          objectChanges.push([parseInt(id.replace("-obj", "")), AFRAME.INSPECTOR.history.updates[id]]);
        }
      } else if (id.includes("@")) {
        const objName = id.split("@")[0];
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
          const putUrl = getUrl + "/object/" + objects[i].id;
          const curId = objects[i].id;
          delete objects[i].id;
          delete objects[i].asset_details;
          updateObject(putUrl, objects[i], curId);
          objects[i].id = curId;
        }
        j++;
      }
      i++;
    }
    this.setState({ objects });
  };

  componentDidMount() {
    Events.on('transformmodechange', mode => {
      this.setState({ selectedTransform: mode });
    });

    Events.on('transformspacechange', () => {
      Events.emit(
        'transformspacechanged',
        this.state.localSpace ? 'world' : 'local'
      );
      this.setState({ localSpace: !this.state.localSpace });
    });
  }

  changeTransformMode = mode => {
    this.setState({ selectedTransform: mode });
    Events.emit('transformmodechange', mode);
    ga('send', 'event', 'Toolbar', 'selectHelper', mode);
  };

  onLocalChange = e => {
    const local = e.target.checked;
    this.setState({ localSpace: local });
    Events.emit('transformspacechanged', local ? 'local' : 'world');
  };

  renderTransformButtons = () => {
    return TransformButtons.map(
      function(option, i) {
        var selected = option.value === this.state.selectedTransform;
        var classes = classNames({
          button: true,
          fa: true,
          [option.icon]: true,
          active: selected
        });

        return (
          <a
            title={option.value}
            key={i}
            onClick={this.changeTransformMode.bind(this, option.value)}
            className={classes}
          />
        );
      }.bind(this)
    );
  };

  render() {
    const watcherClassNames = classnames({
      button: true,
      fa: true,
      'fa-save': true
    });
    const watcherTitle = 'Write changes with aframe-watcher.';
    return (
      <div id="transformToolbar" className="toolbarButtons" style={{width: "250px"}}>
        {this.renderTransformButtons()}
          <button onClick={this.writeChanges} style={{position: "absolute",
          height: "90%",
          width: "120px",
          marginTop: "2px",
          lineHeight: "90%",
          color: "white",
          background: "#EC4E55",
          borderRadius: "4px"}}>
            Save Scene
          </button>
        <span className="local-transform">
          <input
            id="local"
            type="checkbox"
            title="Toggle between local and world space transforms"
            checked={
              this.state.localSpace || this.state.selectedTransform === 'scale'
            }
            disabled={this.state.selectedTransform === 'scale'}
            onChange={this.onLocalChange}
          />
          <label
            htmlFor="local"
            title="Toggle between local and world space transforms"
          >
            local
          </label>
        </span>
      </div>
    );
  }
}
