/* global AFRAME */
import React from 'react';
import PropTypes, { object } from 'prop-types';
import PropertyRow from './PropertyRow';
import Collapsible from '../Collapsible';
import Clipboard from 'clipboard';
import { getComponentClipboardRepresentation } from '../../lib/entity';
import Events from '../../lib/Events';
import Select from 'react-select';
import { updateEntity } from '../../lib/entity';
import axios from 'axios';
import "./w3.css";

const isSingleProperty = AFRAME.schema.isSingleProperty;

function getCookie(name) {
  const r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
  return r ? r[1] : undefined;
}

class GltfPopUp extends React.Component {
  static propTypes = {
  };

  constructor(props) {
    super(props);
    this.state = {
      puzzleType: ""
    };
  }

  closeModal() {
    this.props.closePopup();
  }

  saveModal() {
    this.props.savePopup();
  }

  selectPuzzleType = obj => {
    this.setState({
      puzzleType: obj.value
    });
  }
  
  toggleButton() {
    this.props.toggleButton();
  }

  handleRemove(text){
    this.props.handleRemove(text);
  }

  componentDidMount() {
    this.closeModal = this.closeModal.bind(this);
    this.saveModal = this.saveModal.bind(this);
    this.selectPuzzleType = this.selectPuzzleType.bind(this);
    this.toggleButton = this.toggleButton.bind(this);
    this.handleRemove = this.handleRemove.bind(this);
  }

  render() {
    const puzzleTypeList = [{ value: "text-pane", label: "text-pane" }, { value: "rotation-controls", label: "rotation-controls" }, 
    { value: "keypad", label: "keypad" }, { value: "visual-pane", label: "visual-pane" }, 
    { value: "jigsaw-puzzle", label: "jigsaw-puzzle" }, { value: "ordered-puzzle", label: "ordered-puzzle" }];
    var isObjChecked = this.props.isObjChecked;

    return <div id="id01" className="w3-modal" style={{display:this.props.popupView}}>
    <div className="w3-modal-content w3-card-4 w3-animate-zoom" style={{maxWidth:"600px"}}>

      <div className="w3-center"><br/>
        <span onClick={this.closeModal} className="w3-button w3-xlarge w3-hover-red w3-display-topright" title="Close Modal">&times;</span>
      </div>

      <div>
        <label for="subscribeNews">Interactable?</label>
        <input type="checkbox" id="subscribeNews" name="subscribe" value="newsletter" checked={isObjChecked} onChange={this.toggleButton}></input>
      </div>
      {isObjChecked ? (<Select
        value={puzzleTypeList.filter(option => option.value == this.props.objData.componentType)}
        ref="select"
        options={puzzleTypeList}
        placeholder="Select puzzle type..."
        noResultsText="No puzzle types found"
        searchable={true}
        onChange={this.selectPuzzleType}
      />) : null}
      {isObjChecked && this.props.objData.componentType === "text-pane" ? 
      (
        <ul>
          {this.props.objData.jsonData.data.map((item) => (
            <li key={item.text}>
              <span>{item.text}</span>
              <button type="button" onClick={() => this.handleRemove(item.text)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ): null}

      <div className="w3-container w3-border-top w3-padding-16 w3-light-grey">
        <button onClick={this.closeModal} type="button" className="w3-button w3-red">Cancel</button>
        <button onClick={this.saveModal} type="button" className="w3-button w3-green">Save</button>
      </div>

    </div>
  </div>
  }
}
/**
 * Single component.
 */
export default class Component extends React.Component {
  static propTypes = {
    component: PropTypes.any,
    entity: PropTypes.object,
    isCollapsed: PropTypes.bool,
    name: PropTypes.string
  };

  constructor(props) {
    super(props);
    this.state = {
      entity: this.props.entity,
      name: this.props.name,
      nameList: [],
      objectList: [],
      backgroundList: [],
      assetLinkToTypeMap: new Map(),
      checked: false,
      puzzleType: "",
      idToCheckedMap: new Map(),
      idToPuzzleTypeMap: new Map(),
      idToDataMap: new Map(),
      originalDataMap: new Map(),
      popupView: 'none',
    };
    this.setObjects(this);
  }

  setObjects(self){
    const baseUrl = process.env.REACT_APP_ADMIN_BACKEND_URL;
    const baseEndpoint = process.env.REACT_APP_ADMIN_BASE_ENDPOINT;
    var getUrl = baseUrl + baseEndpoint + "assets";
    const assetsUrl = process.env.REACT_APP_ADMIN_ASSET_PREFIX_URL;
    const apiEndpointScene = AFRAME.scenes[0].getAttribute("id").replace("-scene", "");

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
      const assets = response.data.assets;
      let nameList = [];
      let objectList = [];
      let backgroundList = [];
      let assetLinkToTypeMap = new Map();
      assets.forEach(function( item, index) {
        nameList.push({ value: assetsUrl+item.s3_key, label: item.name });
        if (item.obj_type == "background"){
          backgroundList.push({ value: assetsUrl+item.s3_key, label: item.name });
          assetLinkToTypeMap[assetsUrl+item.s3_key] = "background";
        } else{
          objectList.push({ value: assetsUrl+item.s3_key, label: item.name });
          assetLinkToTypeMap[assetsUrl+item.s3_key] = "object";
        }
      });
      self.setState({ nameList, objectList, backgroundList, assetLinkToTypeMap });
    });

    getUrl = baseUrl + baseEndpoint + "scene/" + apiEndpointScene;
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
      let idToCheckedMap = new Map();
      let idToDataMap = new Map();
      let originalDataMap = new Map();
      let objects = response.data.objects;
      for (var i = 0; i < objects.length; i++ ){
        idToCheckedMap[objects[i].id+"-obj"] = objects[i].is_interactable;
        idToDataMap[objects[i].id+"-obj"] = objects[i].animations_json.blackboardData;
        originalDataMap[objects[i].id+"-obj"] = JSON.parse(JSON.stringify(objects[i].animations_json.blackboardData));
        // if objects[i].is_inter then check puzzle type and put into map
        // if puzzle type is text-pane, then set based json_data
      }
      self.setState({ idToCheckedMap, idToDataMap, originalDataMap });
    });
  }

  componentDidMount() {
    this.showPopup = this.showPopup.bind(this);
    this.closePopup = this.closePopup.bind(this);
    this.savePopup = this.savePopup.bind(this);
    this.toggleButton = this.toggleButton.bind(this);
    this.handleRemove = this.handleRemove.bind(this);
    var clipboard = new Clipboard(
      '[data-action="copy-component-to-clipboard"]',
      {
        text: trigger => {
          var componentName = trigger
            .getAttribute('data-component')
            .toLowerCase();
          ga(
            'send',
            'event',
            'Components',
            'copyComponentToClipboard',
            componentName
          );
          return getComponentClipboardRepresentation(
            this.state.entity,
            componentName
          );
        }
      }
    );
    clipboard.on('error', e => {
      // @todo Show the error in the UI
      console.error(e);
    });

    Events.on('entityupdate', detail => {
      if (detail.entity !== this.props.entity) {
        return;
      }
      if (detail.component === this.props.name) {
        this.forceUpdate();
      }
    });
  }

  componentWillReceiveProps(newProps) {
    if (this.state.entity !== newProps.entity) {
      this.setState({ entity: newProps.entity });
    }
    if (this.state.name !== newProps.name) {
      this.setState({ name: newProps.name });
    }
  }

  removeComponent = event => {
    var componentName = this.props.name;
    event.stopPropagation();
    if (
      confirm('Do you really want to remove component `' + componentName + '`?')
    ) {
      this.props.entity.removeAttribute(componentName);
      Events.emit('componentremove', {
        entity: this.props.entity,
        component: componentName
      });
      ga('send', 'event', 'Components', 'removeComponent', componentName);
    }
  };

  selectOption = obj => {
    updateEntity.apply(this, [this.props.entity, this.props.name, obj.value]);
  }

  showPopup() {
    this.setState({ popupView: 'block' });
  }

  closePopup() {
    let idToDataMap = this.state.idToDataMap;
    let originalDataMap = this.state.originalDataMap;
    const id = this.props.entity.getAttribute("id");
    console.log("before");
    console.log(this.state.idToDataMap[id].jsonData.data);
    console.log(this.state.originalDataMap[id].jsonData.data);
    idToDataMap[id].jsonData.data = originalDataMap[id].jsonData.data;
    console.log("after");
    console.log(this.state.idToDataMap[id].jsonData.data);
    console.log(this.state.originalDataMap[id].jsonData.data);
    this.setState({ idToDataMap: idToDataMap, popupView: 'none' });
  }

  savePopup() {
    // request to save
    this.setState({ popupView: 'none' });
  }

  handleRemove(text){
    let idToDataMap = this.state.idToDataMap;
    const id = this.props.entity.getAttribute("id");
    const newList = idToDataMap[id].jsonData.data.filter((item) => item.text !== text);
    idToDataMap[id].jsonData.data = newList
    this.setState({ idToDataMap });
  }

  toggleButton() {
    const objId = this.props.entity.getAttribute("id");//.replace("-obj", "");
    let idToCheckedMap = this.state.idToCheckedMap;
    if (!(objId in this.state.idToCheckedMap)){
      idToCheckedMap[objId] = true;
    } else{
      idToCheckedMap[objId] = !this.state.idToCheckedMap[objId];
    }
    this.setState({ idToCheckedMap });
  }
  /**
   * Render propert(ies) of the component.
   */
  renderPropertyRows = () => {
    const componentData = this.props.component;
    const customStyles = {
      option: (provided, state) => ({
        provided,
        color: state.isSelected ? 'blue' : 'black',
        padding: 20,
      })
    };

    if (isSingleProperty(componentData.schema)) {
      const componentName = this.props.name;
      const schema = AFRAME.components[componentName.split('__')[0]].schema;

      if (componentName != 'gltf-model'){
        return (
          <PropertyRow
            key={componentName}
            name={componentName}
            schema={schema}
            data={componentData.data}
            componentname={componentName}
            isSingle={true}
            entity={this.props.entity}
          />
        );
      } else{
        const whichAssetType = this.state.assetLinkToTypeMap[componentData.data];
        let whichOptions = this.state.objectList;
        if (whichAssetType == "background"){
          whichOptions = this.state.backgroundList;
        }
        const objId = this.props.entity.getAttribute("id");//.replace("-obj", "");
        let isObjChecked = false;
        let objData = null;
        if (objId in this.state.idToCheckedMap){
          isObjChecked = this.state.idToCheckedMap[objId];
        }
        if (objId in this.state.idToDataMap){
          objData = this.state.idToDataMap[objId];
        }
        return (
          <div>
            <Select
              styles={customStyles}
              value={this.state.nameList.filter(option => option.value == componentData.data)}
              ref="select"
              options={whichOptions}
              placeholder="Add component..."
              noResultsText="No components found"
              searchable={true}
              onChange={this.selectOption}
            />
            <GltfPopUp
              popupView={this.state.popupView}
              isObjChecked={isObjChecked}
              closePopup={this.closePopup}
              savePopup={this.savePopup}
              toggleButton={this.toggleButton}
              objData={objData}
              handleRemove={this.handleRemove}
            />
            {objId.endsWith("-obj") ? <button onClick={this.showPopup} className="w3-button w3-green w3-large">Edit Puzzle Type</button> : null}
          </div>
        );
      }
    }

    return Object.keys(componentData.schema)
      .sort()
      .map(propertyName => (
        <PropertyRow
          key={propertyName}
          name={propertyName}
          schema={componentData.schema[propertyName]}
          data={componentData.data[propertyName]}
          componentname={this.props.name}
          isSingle={false}
          entity={this.props.entity}
        />
      ));
  };

  render() {
    let componentName = this.props.name;
    let subComponentName = '';
    if (componentName.indexOf('__') !== -1) {
      subComponentName = componentName;
      componentName = componentName.substr(0, componentName.indexOf('__'));
    }
    // alert(componentName);
    // alert(subComponentName);

    return (
      <Collapsible collapsed={this.props.isCollapsed}>
        <div className="componentHeader collapsible-header">
          <span
            className="componentTitle"
            title={subComponentName || componentName}>
            <span>{subComponentName || componentName}</span>
          </span>
          <div className="componentHeaderActions">
            <a
              title="Copy to clipboard"
              data-action="copy-component-to-clipboard"
              data-component={subComponentName || componentName}
              className="button fa fa-clipboard"
              href="#"
            />
            <a
              title="Remove component"
              className="button fa fa-trash-o"
              onClick={this.removeComponent}
            />
          </div>
        </div>
        <div className="collapsible-content">{this.renderPropertyRows()}</div>
      </Collapsible>
    );
  }
}
