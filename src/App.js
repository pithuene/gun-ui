import './App.css';

import Gun from 'gun';
import React, { useEffect, useState } from 'react';
import { Graph } from 'react-d3-graph';

import Vertex from './Vertex';

// const gun = new Gun('http://192.168.178.64:8765/gun');
require('gun/lib/open.js');

let gunListeners = new Set();

const vertices = [{ id: 'gun', props: { root: '' } }];
const edges = [];

function App() {
	const [graph, setGraph] = useState({
		nodes: vertices,
		links: edges,
	});

	const [endpoint, setEndpoint] = useState('');

	const [root, setRoot] = useState('document');

	const [gun, setGun] = useState(new Gun());

	useEffect(() => {
		gunListeners.forEach((soul) => {
			gun.get(soul).off();
			gunListeners.delete(soul);
		});
	}, [gun]);

	const loadEndpoint = () => {
		setGun(new Gun(endpoint));
		setGraph((graph) => {
			return {
				nodes: vertices,
				links: edges,
			};
		});
		window.gun = gun;
	};

	useEffect(() => {
		console.log(
			`Peers set to: ${
				Object.keys(gun._.opt.peers).length > 0
					? Object.keys(gun._.opt.peers).reduce(
							(a, b) => a + ', ' + b
					  )
					: 'No peers connected'
			}`
		);
	}, [gun]);

	const getPath = (path) => {
		let currentReference = gun;
		for (let i = 0; i < path.length; i++) {
			currentReference = currentReference.get(path[i]);
		}
		return currentReference;
	};

	const resetGraph = () => {
		setGraph(() => {
			return {
				nodes: vertices,
				links: edges,
			};
		});
	};

	const insertDataFromGun = async (path, parentId) => {
		resetGraph();
		const graph = await getDataFromGun(path, parentId);

		console.log(graph.vertices);
		console.log(graph.edges);

		setGraph(() => {
			return {
				nodes: graph.vertices || vertices,
				links: graph.edges || edges,
			};
		});
		removeUnreferencedNode('gun');
	};

	const addGunListener = (soul) => {
		if (!gunListeners.has(soul)) {
			console.log('Added listener to node: ' + soul);
			gun.get(soul).on(handleNodeChange, { change: true });
			gunListeners.add(soul);
		}
	};

	const removeUnreferencedNode = (soul) => {
		console.log(`Removing unreferenced Nodes`);
		const index = graph.links.findIndex((edge) => edge.target === soul);
		console.log(`Node still referenced?: ${index === -1 ? 'No' : 'Yes'}`);
		if (index === -1) {
			removeNode(soul);
		}
	};

	const removeNode = (soul) => {
		gun.get(soul).off();
		setGraph((data) => {
			let nodes = data.nodes;
			if (nodes.length <= 1) {
				console.warn(
					`Didn't delete node "${soul}", it is the last node`
				);
				return data;
			}
			console.log(`Searching node with soul: ${soul}`);
			const nodeId = nodes.findIndex((node) => node.id === soul);
			if (nodeId === -1) {
				console.error(`No node found!`);
				return data;
			}
			console.log(`Removing node at index: ${nodeId}`);
			nodes.splice(nodeId, 1);
			return { ...data, nodes: nodes };
		});
	};

	const handleNodeChange = (change) => {
		setGraph((data) => {
			const id = change['_']['#'];

			console.log(`Setting data of node: "${id}"`);

			if (!data) return data;

			let oldNodes = data.nodes;
			let oldLinks = data.links;

			const idx = oldNodes.findIndex((node) => node.id === id);

			if (idx === -1) {
				console.error('id not found');
				return data;
			}
			console.log(`Found node with index: "${idx}"`);

			let newProps = {};
			let newVertices = [];
			let newEdges = [];
			let propsToRemove = [];

			for (const prop in change) {
				// Ignore the soul
				if (prop === '_') continue;
				// Is this property currently given to a child node?
				const childEdgeIndex = oldLinks.findIndex((edge) => {
					return edge.label === prop && edge.source === id;
				});
				// If so, remove the edge
				if (childEdgeIndex !== -1) {
					removeUnreferencedNode(oldLinks[childEdgeIndex].target);
					oldLinks.splice(childEdgeIndex, 1);
				}
				// Property is new child Node
				const propVal = change[prop];
				if (propVal && propVal['#'] !== undefined) {
					// Add new node
					const newNodeSoul = propVal['#'];
					newVertices.push({
						id: newNodeSoul,
						props: {},
					});
					newEdges.push({
						source: id,
						target: newNodeSoul,
						label: prop,
					});
					addGunListener(newNodeSoul);
					// Remove old property from parent if it exists
					if (oldNodes[idx].props[prop] !== undefined) {
						propsToRemove.push(prop);
					}
					continue;
				}
				// Add property to node props
				newProps[prop] = change[prop];
			}

			console.log('Adding props');
			console.log(newProps);

			for (const p in oldNodes[idx]['props']) {
				if (!propsToRemove.includes(p) && newProps[p] === undefined) {
					newProps[p] = oldNodes[idx]['props'][p];
				}
			}

			oldNodes[idx]['props'] = newProps;

			oldNodes.push(...newVertices);
			oldLinks.push(...newEdges);

			console.log('New nodes');
			console.log(oldNodes);

			return {
				nodes: oldNodes,
				links: oldLinks,
			};
		});
	};

	const getDataFromGun = async (path, parentId) => {
		return new Promise(async (resolve, reject) => {
			let graph = { vertices: [], edges: [] };
			getPath(path).once(async (nodeProperties) => {
				const soul = nodeProperties['_']['#'];

				addGunListener(soul);

				let props = {};
				for (let prop in nodeProperties) {
					if (prop === '_') continue;
					if (
						nodeProperties[prop] &&
						nodeProperties[prop]['#'] !== undefined
					) {
						const childSoul = nodeProperties[prop]['#'];
						// If the vertex is already listed (referenceed multiple times)
						if (
							graph.vertices.findIndex(
								(vertex) => vertex.id === childSoul
							) !== -1
						) {
							graph.edges.push({
								source: soul,
								target: childSoul,
								label: prop,
							});
							continue;
						}
						let childGraph = await getDataFromGun(
							[...path, prop],
							soul
						);
						graph.vertices = [
							...graph.vertices,
							...childGraph.vertices,
						];
						graph.edges = [...graph.edges, ...childGraph.edges];
						continue;
					}
					props[prop] = nodeProperties[prop];
				}
				graph.vertices.push({
					id: soul,
					props,
				});
				if (parentId !== null) {
					graph.edges.push({
						source: parentId,
						target: soul,
						label: path[path.length - 1],
					});
				}
				console.log('Got Data from Graph:');
				console.log(graph);

				resolve(graph);
			});
		});
	};

	const graphConfig = {
		directed: true,
		nodeHighlightBehavior: true,
		staticGraphWithDragAndDrop: false, // If false, can be removed
		automaticRearrangeAfterDropNode: false, // If false, can be removed
		node: {
			renderLabel: false,
			size: 1000,
			viewGenerator: (node) => <Vertex node={node} />,
		},
		link: {
			highlightColor: 'blue',
			renderLabel: true,
			highlightFontWeight: 'bold',
			semanticStrokeWidth: true,
			fontSize: 12,
		},
		d3: {
			gravity: -1000,
			linkLength: 50,
		},
	};

	const windowStyle = {
		backgroundColor: '#282828',
		padding: '2rem',
	};

	const graphStyle = {
		backgroundColor: '#FFF',
	};

	return (
		<div className="App">
			<h1>GunDB Overview</h1>
			<label>Endpoint</label>
			<br />
			<input
				value={endpoint}
				onChange={(ev) => {
					setEndpoint(ev.target.value);
				}}
				type="text"
			/>
			<br />
			<label>Root</label>
			<br />
			<input
				value={root}
				onChange={(ev) => {
					setRoot(ev.target.value);
				}}
				type="text"
			/>
			<br />
			<button onClick={() => insertDataFromGun([root], null)}>
				Load Data from Gun
			</button>
			<button onClick={() => loadEndpoint()}>Load Endpoint</button>

			<div style={windowStyle}>
				<div style={graphStyle}>
					<Graph id="graph-id" data={graph} config={graphConfig} />
				</div>
			</div>
		</div>
	);
}

export default App;
