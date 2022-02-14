import classnames from 'classnames';
import axios from 'axios';
var React = require('react');
var Events = require('../../lib/Events.js');
var classNames = require('classnames');
import {updateObject, addObject, deleteObject, editBackground} from '../scenegraph/Toolbar.js';

var TransformButtons = [
  { value: 'translate', icon: 'fa-arrows-alt' },
  { value: 'scale', icon: 'fa-expand' },
  { value: 'rotate', icon: 'fa-repeat' }
];

export default class TransformToolbar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedTransform: 'translate',
      localSpace: false,
      objects: [],
      linkToIdMap: null,
      sceneBody: null,
      showSuccess: false,
      successText: "",
      showError: false,
      errorText: "",
      msg: ""
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

  writeChanges = async() => {
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

    let hasFail = false;
    let addedObjects = [];
    let deletedObjects = [];

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
          let msg = await editBackground(getUrl, sceneBody, backgroundModelChanged);
          this.setState({ msg });
        }
      } else if (id.endsWith("-obj")){
        if ("delete" in AFRAME.INSPECTOR.history.updates[id]){
          const deleteUrl = baseUrl + baseEndpoint + "scene/" + apiEndpointScene + "/object/" + id.replace("-obj", "");
          let msg = await deleteObject(deleteUrl, id.replace("-obj", ""));
          if (!msg.startsWith("Error: ")){
            deletedObjects.push(msg);
          } else {
            hasFail = true;
            this.setState({ msg });
          }
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
        let msg = await addObject(postUrl, basicObject, this);
        if (!msg.startsWith("Error: ")){
          addedObjects.push(msg);
        } else {
          hasFail = true;
          this.setState({ msg });
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

    objectChanges.sort();
    objects.sort((a,b) => a.id - b.id);

    let i = 0;
    let j = 0;
    let updatedObjects = [];
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
          let msg = await updateObject(putUrl, objects[i], curId);
          if (!msg.startsWith("Error: ")){
            updatedObjects.push(msg);
          } else {
            hasFail = true;
            this.setState({ msg });
          }
          objects[i].id = curId;
        }
        j++;
      }
      i++;
    }
    let msg1 = "";
    let msg2 = "";
    let msg3 = "";
    if (!hasFail && addedObjects.length > 0){
      msg1 = "added " + addedObjects.toString();
    }
    if (!hasFail && updatedObjects.length > 0){
      msg2 = "updated " + updatedObjects.toString();
    }
    if (!hasFail && deletedObjects.length > 0){
      msg3 = "deleted " + deletedObjects.toString();
    }
    let msg = msg1;
    if (msg != "" && msg2 != ""){
      msg += ", ";
    }
    msg += msg2;
    if (msg != "" && msg3 != ""){
      msg += ", ";
    }
    msg += msg3;
    if (!hasFail && msg != ""){
      msg = "Object ID changes: " + msg;
      this.setState({ msg });
    }
    this.setState({ objects });
    setTimeout(this.clearMsg, 5000);
  };

  clearMsg = () => {
    let msg = "";
    this.setState({ msg });
  }

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
    const handleSuccessClose = (event, reason) => {
      if (reason === 'clickaway') {
        return;
      }
  
      this.setState({showSuccess: false});
    };
    return (
      <div id="transformToolbar" className="toolbarButtons" style={{width: "fit-content", marginRight: "50px"}}>
      <span id="modifyThis">{this.state.msg}</span>
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
