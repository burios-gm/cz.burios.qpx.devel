package cz.burios.qpx.darwin.controller.rest;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import cz.burios.qpx.darwin.db.DBContext;
import cz.burios.qpx.darwin.db.model.BasicRecord;
import cz.burios.qpx.darwin.db.uniql.dsl.DSL;
import jakarta.servlet.http.HttpServletRequest;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/data")
public class ContactController {

	@GetMapping(path = "/contacts")
	public List<BasicRecord> handleGridData(
		@RequestParam Map<String, Object> params,
		HttpServletRequest request) {

		System.out.println("ContactController.getAll()");
		try {
			System.out.println("params: " + params);
		} catch (Exception e) {
			e.printStackTrace();
		}
		List<BasicRecord> contacts = getAllData();
		return contacts;
	}

	protected List<BasicRecord> getAllData() {
		List<BasicRecord> data = new ArrayList<>();
		try {
			data = DSL.select("NUMBER", "CODE3", "CODE2", "NAME").from("countries").list(DBContext.getConnection());
		} catch (Exception e) {
			e.printStackTrace();
		}
		return data;
	}
}