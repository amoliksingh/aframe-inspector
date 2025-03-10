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

class GltfPopUp extends React.Component {
  static propTypes = {
  };

  constructor(props) {
    super(props);
  }

  closeModal() {
    this.props.closePopup();
  }

  componentDidMount() {
    this.closeModal = this.closeModal.bind(this);
  }

  render() {
    var frontendSceneUrl = process.env.REACT_APP_ADMIN_FRONTEND_SCENE_URL;
    var iframeLink = frontendSceneUrl + this.props.sceneId + "/object/" + this.props.objectId;

    return <div id="id01" className="w3-modal" style={{display:this.props.popupView, paddingTop: "5vh"}}>
    <div className="w3-modal-content w3-card-4 w3-animate-zoom" style={{width:"70%"}}>

      <div className="w3-center"><br/>
        <span onClick={this.closeModal} className="w3-button w3-xlarge w3-hover-red w3-display-topright" title="Close Modal" style={{color: "black"}}>&times;</span>
      </div>

      <div style={{height: "80vh"}}>
        <iframe src={iframeLink} title="Test" style={{height: "80vh", width: "95%", marginBottom: "10vh"}}></iframe>
      </div>

      <div className="w3-container w3-border-top w3-padding-16 w3-light-grey">
        <button onClick={this.closeModal} type="button" className="w3-button w3-red">Cancel</button>
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
  }

  componentDidMount() {
    this.showPopup = this.showPopup.bind(this);
    this.closePopup = this.closePopup.bind(this);

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
    this.setState({ popupView: 'none' });
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
            {objId.endsWith("-obj") ? 
            <div style={{display:"flex", justifyContent:"center"}}>
              <GltfPopUp
                popupView={this.state.popupView}
                sceneId={AFRAME.scenes[0].getAttribute("id").replace("-scene", "")}
                objectId={objId.replace("-obj", "")}
                closePopup={this.closePopup}
              />
              <button onClick={this.showPopup} className="w3-button w3-large" style={{
                background:"#BFCFE0",
                borderRadius:"4px",
                color:"black",
                margin:"auto",
                marginTop:"10px"
              }}>Edit Puzzle Type</button>
            </div> : null}
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

    if (componentName !== "gltf-model") {
      return null;
    }

    return (
      <Collapsible collapsed={false}>
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
          </div>
        </div>
        <div className="collapsible-content">{this.renderPropertyRows()}</div>
      </Collapsible>
    );
  }
}
