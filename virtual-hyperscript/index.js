'use strict';

var isArray = require('x-is-array');
var VNode = require('../vnode/vnode.js');
var VText = require('../vnode/vtext.js');
var isVNode = require('../vnode/is-vnode');
var isVText = require('../vnode/is-vtext');
var isWidget = require('../vnode/is-widget');
var isHook = require('../vnode/is-vhook');
var isVThunk = require('../vnode/is-thunk');

var parseTag = require('./parse-tag.js');
var softSetHook = require('./hooks/soft-set-hook.js');
var evHook = require('./hooks/ev-hook.js');

module.exports = h;
var arrayAttibutes = [
	'id',
	'alt',
	'title',
	'className',
	'attributes',
	'style',
	'key'
];

function formatProperties (properties) {
	var _p = {};
	_p.attributes = {}
	for(var i = 0; i < Object.keys(properties).length; i++) {
		if(Object.keys(properties)[i] === 'classname') {
			_p.className = properties[Object.keys(properties)[i]]
		} else if(arrayAttibutes.indexOf(Object.keys(properties)[i]) === -1 ){
			_p.attributes[Object.keys(properties)[i]] =	properties[Object.keys(properties)[i]]
		} else {
			_p[Object.keys(properties)[i]] =	properties[Object.keys(properties)[i]]
		}
	}
	return _p;
}

function h(tagName, properties, children) {
    var childNodes = [];
    var tag, props, key, namespace;
		if(properties) {
			properties = formatProperties(properties);
		}

    if (!children && isChildren(properties)) {
        children = properties;
        props = {};
    }

    props = props || properties || {};
    tag = parseTag(tagName, props);

    // support keys
    if (props.hasOwnProperty('key')) {
        key = props.key;
        props.key = undefined;
    }

    // support namespace
    if (props.hasOwnProperty('namespace')) {
        namespace = props.namespace;
        props.namespace = undefined;
    }

    // fix cursor bug
    if (tag === 'INPUT' &&
        !namespace &&
        props.hasOwnProperty('value') &&
        props.value !== undefined &&
        !isHook(props.value)
    ) {
        if (props.value !== null && typeof props.value !== 'string') {
            throw UnsupportedValueType({
                expected: 'String',
                received: typeof props.value,
                Vnode: {
                    tagName: tag,
                    properties: props
                }
            });
        }
        props.value = softSetHook(props.value);
    }

    transformProperties(props);
    if (children !== undefined && children !== null) {
        addChild(children, childNodes, tag, props);
    }

    return new VNode(tag, props, childNodes, key, namespace);
}

function createVNodeElement(c, childNodes) {
  for (var i = 0; i < c.childNodes.length; i++) {
    var el = c.childNodes[i];
    if(el.tagName) {
        var props = {}
        for(var j = 0; j < el.attributes.length; j++) {
          props[el.attributes[j].name] = el.attributes[j].value
        }
        if(el.innerHTML){
          var template = h(el.tagName, props, el)
          childNodes.push(new VNode(template.tagName, template.properties, template.children));
        } else if(el.innerHTML === "" && el.attributes.length){
					props = formatProperties(props)
          childNodes.push(new VNode(el.tagName, props));
        } else {
          childNodes.push(new VNode(el.tagName));
        }
    }else if(el.textContent.trim() != ""){
      childNodes.push(new VText(String(el.textContent)));
    }
  }
}

function addChild(c, childNodes, tag, props) {
    if (typeof c === 'string') {
        childNodes.push(new VText(c));
    } else if (typeof c === 'object' && c.childNodes && c.childNodes.length) {
      createVNodeElement(c, childNodes)
    } else if (typeof c === 'number') {
        childNodes.push(new VText(String(c)));
    } else if (isChild(c)) {
        childNodes.push(c);
    } else if (isArray(c)) {
        for (var i = 0; i < c.length; i++) {
            addChild(c[i], childNodes, tag, props);
        }
    } else if (c === null || c === undefined) {
        return;
    } else {
        throw UnexpectedVirtualElement({
            foreignObject: c,
            parentVnode: {
                tagName: tag,
                properties: props
            }
        });
    }
}

function transformProperties(props) {
    for (var propName in props) {
        if (props.hasOwnProperty(propName)) {
            var value = props[propName];

            if (isHook(value)) {
                continue;
            }

            if (propName.substr(0, 3) === 'ev-') {
                // add ev-foo support
                props[propName] = evHook(value);
            }
        }
    }
}

function isChild(x) {
    return isVNode(x) || isVText(x) || isWidget(x) || isVThunk(x);
}

function isChildren(x) {
    return typeof x === 'string' || isArray(x) || isChild(x);
}

function UnexpectedVirtualElement(data) {
    var err = new Error();

    err.type = 'virtual-hyperscript.unexpected.virtual-element';
    err.message = 'Unexpected virtual child passed to h().\n' +
        'Expected a VNode / Vthunk / VWidget / string but:\n' +
        'got:\n' +
        errorString(data.foreignObject) +
        '.\n' +
        'The parent vnode is:\n' +
        errorString(data.parentVnode)
        '\n' +
        'Suggested fix: change your `h(..., [ ... ])` callsite.';
    err.foreignObject = data.foreignObject;
    err.parentVnode = data.parentVnode;

    return err;
}

function UnsupportedValueType(data) {
    var err = new Error();

    err.type = 'virtual-hyperscript.unsupported.value-type';
    err.message = 'Unexpected value type for input passed to h().\n' +
        'Expected a ' +
        errorString(data.expected) +
        ' but got:\n' +
        errorString(data.received) +
        '.\n' +
        'The vnode is:\n' +
        errorString(data.Vnode)
        '\n' +
        'Suggested fix: Cast the value passed to h() to a string using String(value).';
    err.Vnode = data.Vnode;

    return err;
}

function errorString(obj) {
    try {
        return JSON.stringify(obj, null, '    ');
    } catch (e) {
        return String(obj);
    }
}
