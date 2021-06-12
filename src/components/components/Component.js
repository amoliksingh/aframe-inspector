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
      idToPuzzleTypeMap: new Map()
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
      let objects = response.data.objects;
      // console.log(objects);
      for (var i = 0; i < objects.length; i++ ){
        idToCheckedMap[objects[i].id+"-obj"] = objects[i].is_interactable;
        // if objects[i].is_inter then check puzzle type and put into map
        // if puzzle type is text-pane, then set based json_data
      }
      // console.log(idToCheckedMap);
      self.setState({ idToCheckedMap });
    });
  }

  componentDidMount() {
    this.toggleButton = this.toggleButton.bind(this);
    this.selectPuzzleType = this.selectPuzzleType.bind(this);
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

  selectPuzzleType = obj => {
    this.setState({
      puzzleType: obj.value
    });
  }

  toggleButton = button => {
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
    const puzzleTypeList = [{ value: "text-pane", label: "text-pane-label" }];
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
        if (objId in this.state.idToCheckedMap){
          isObjChecked = this.state.idToCheckedMap[objId];
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
            <div id="id01" className="w3-modal">
              <div className="w3-modal-content w3-card-4 w3-animate-zoom" style={{maxWidth:"600px"}}>

                <div className="w3-center"><br/>
                  <span onClick="document.getElementById('id01').style.display='none'" className="w3-button w3-xlarge w3-hover-red w3-display-topright" title="Close Modal">&times;</span>
                  <img src="img_avatar4.png" alt="Avatar" style={{width:"30%"}} className="w3-circle w3-margin-top"/>
                </div>

                <form className="w3-container" action="/action_page.php">
                  <div className="w3-section">
                    <label><b>Username</b></label>
                    <input className="w3-input w3-border w3-margin-bottom" type="text" placeholder="Enter Username" name="usrname" required/>
                    <label><b>Password</b></label>
                    <input className="w3-input w3-border" type="password" placeholder="Enter Password" name="psw" required/>
                    <button className="w3-button w3-block w3-green w3-section w3-padding" type="submit">Login</button>
                    <input className="w3-check w3-margin-top" type="checkbox" checked="checked"/> Remember me
                  </div>
                </form>

                <div className="w3-container w3-border-top w3-padding-16 w3-light-grey">
                  <button onclick="document.getElementById('id01').style.display='none'" type="button" className="w3-button w3-red">Cancel</button>
                  <span className="w3-right w3-padding w3-hide-small">Forgot <a href="#">password?</a></span>
                </div>

              </div>
            </div>
            {objId.endsWith("-obj") ? <button onClick="document.getElementById('id01').style.display='block'" className="w3-button w3-green w3-large">Edit Puzzle Type</button> : null}
            <div>
              <label for="subscribeNews">Interactable?</label>
              <input type="checkbox" id="subscribeNews" name="subscribe" value="newsletter" checked={isObjChecked} onChange={this.toggleButton}></input>
            </div>
            {isObjChecked ? (<Select
              styles={customStyles}
              //value={puzzleTypeList.filter(option => option.value == componentData.data)}
              ref="select"
              options={puzzleTypeList}
              placeholder="Select puzzle type..."
              noResultsText="No puzzle types found"
              searchable={true}
              onChange={this.selectPuzzleType}
            />) : null}
            {/* {isObjChecked && puzzleType === "text-pane" ? (<p>methodToRenderTextPanes</p>): null} */}
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
